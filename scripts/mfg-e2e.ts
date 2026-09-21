// Manufacturing end-to-end: coverage answer -> transfer_stock with approval
// -> create effect via create_shipment -> live agent run -> confirm ->
// write-back -> audit chain verify.
// Usage: NVIDIA_API_KEY=... npx tsx scripts/mfg-e2e.ts
import { db } from "../lib/core/db";
import { twinOverview } from "../lib/packs/manufacturing/service";
import { decideApproval, executeAction, requestApproval } from "../lib/core/ontology/execute";
import { executeManufacturingAction } from "../lib/packs/manufacturing/actions";
import { verifyEventChain } from "../lib/core/ontology/facts";
import { runAgent } from "../lib/core/agent/runtime";
import { resolveLLM } from "../lib/core/agent/provider";
import { manufacturingToolExecutors } from "../lib/packs/agent-tools";
import { manufacturingAgentContext } from "../lib/packs/agent";
import { evalAnswer } from "../lib/core/agent/evals";

function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.log("no org");
    return;
  }
  const membership = await db.membership.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } });
  const actor = membership?.userId ?? "e2e";
  const orgId = org.id;

  // 1. Coverage answer from the twin.
  const overview = await twinOverview(orgId);
  check("twin has lots", overview.counts.lots > 0);
  const south = await db.ontoObject.findFirst({ where: { organizationId: orgId, typeKey: "mfg_inventory_lot", key: "lot_south_b" } });
  const central = await db.ontoObject.findFirst({ where: { organizationId: orgId, typeKey: "mfg_inventory_lot", key: "lot_central_b" } });
  check("fixture lots exist", Boolean(south && central));

  // 2. transfer_stock with approval (small transfer, single approval).
  const beforeSouth = Number((south!.data as Record<string, unknown>).qty_on_hand);
  const beforeCentral = Number((central!.data as Record<string, unknown>).qty_on_hand);
  const noApproval = await executeManufacturingAction(orgId, actor, "mfg_transfer_stock", south!.id, { toLotId: central!.id, qty: 10 }, `e2e-transfer-${Date.now()}`);
  check("transfer without approval is rejected", !noApproval.ok && noApproval.needsApproval === true);
  const req = await requestApproval(orgId, actor, { actionKey: "mfg_transfer_stock", objectId: south!.id, inputs: { toLotId: central!.id, qty: 10 } });
  check("approval requested", req.ok);
  if (!req.ok) return;
  const decided = await decideApproval(orgId, req.value.id, actor, true, "e2e");
  check("approval granted", decided.ok);
  if (!decided.ok) return;
  const transferKey = `e2e-transfer-${Date.now()}`;
  const done = await executeManufacturingAction(
    orgId,
    actor,
    "mfg_transfer_stock",
    south!.id,
    { toLotId: central!.id, qty: 10 },
    transferKey,
    req.value.id
  );
  check("transfer executed", done.ok);
  const afterSouth = await db.ontoObject.findUniqueOrThrow({ where: { id: south!.id } });
  const afterCentral = await db.ontoObject.findUniqueOrThrow({ where: { id: central!.id } });
  check("source decremented", Number((afterSouth.data as Record<string, unknown>).qty_on_hand) === beforeSouth - 10);
  check("destination incremented", Number((afterCentral.data as Record<string, unknown>).qty_on_hand) === beforeCentral + 10);

  // 3. create effect via create_shipment (with approval).
  const shipReq = await requestApproval(orgId, actor, {
    actionKey: "mfg_create_shipment",
    objectId: afterCentral.id,
    inputs: { shipmentId: `E2E-SHIP-${Date.now()}`, qty: 5 },
  });
  check("shipment approval requested", shipReq.ok);
  if (shipReq.ok) {
    await decideApproval(orgId, shipReq.value.id, actor, true, "e2e");
    const ship = await executeManufacturingAction(
      orgId,
      actor,
      "mfg_create_shipment",
      afterCentral.id,
      { shipmentId: `E2E-SHIP-${Date.now()}`, qty: 5 },
      `e2e-ship-${Date.now()}`,
      shipReq.value.id
    );
    check("shipment created via create effect", ship.ok && (ship.createdIds?.length ?? 0) === 1);
    if (ship.ok && ship.createdIds?.[0]) {
      await db.ontoObject.delete({ where: { id: ship.createdIds[0] } });
      await db.ontoEdge.deleteMany({ where: { organizationId: orgId, fromId: ship.createdIds[0] } });
      console.log("PASS e2e shipment cleaned up");
    }
  }

  // 4. Idempotency: replay the transfer with the same key.
  const replay = await executeAction(orgId, actor, {
    actionKey: "mfg_transfer_stock",
    objectId: south!.id,
    inputs: { toLotId: central!.id, qty: 10, sourceAfter: beforeSouth - 10, targetAfter: beforeCentral + 10 },
    idempotencyKey: transferKey,
    approvalId: req.value.id,
  });
  check("replay returns the original run", replay.ok && replay.replayed === true);
  const afterReplay = await db.ontoObject.findUniqueOrThrow({ where: { id: south!.id } });
  check(
    "replay changes nothing",
    Number((afterReplay.data as Record<string, unknown>).qty_on_hand) === Number((afterSouth.data as Record<string, unknown>).qty_on_hand)
  );

  // 4b. Pre-commit webhook delivers, then vetoes.
  const { createServer } = await import("node:http");
  const received: Array<{ headers: Record<string, string>; body: string }> = [];
  const echo = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      received.push({ headers: req.headers as Record<string, string>, body: raw });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", resolve));
  const echoPort = (echo.address() as { port: number }).port;
  await db.ontoWebhook.upsert({
    where: { organizationId_actionKey: { organizationId: orgId, actionKey: "mfg_adjust_safety_stock" } },
    create: { organizationId: orgId, actionKey: "mfg_adjust_safety_stock", url: `http://127.0.0.1:${echoPort}/hook`, secret: "e2e-secret" },
    update: { url: `http://127.0.0.1:${echoPort}/hook`, secret: "e2e-secret", active: true },
  });
  const hookOk = await executeManufacturingAction(orgId, actor, "mfg_adjust_safety_stock", south!.id, { safetyStock: 77 }, `e2e-hook-ok-${Date.now()}`);
  check("webhook allows the write", hookOk.ok);
  check("webhook received a signed call", received.length === 1 && typeof received[0]!.headers["x-monad-signature"] === "string");
  const hookRow = await db.ontoWebhook.findUniqueOrThrow({ where: { organizationId_actionKey: { organizationId: orgId, actionKey: "mfg_adjust_safety_stock" } } });
  check("webhook delivery recorded", hookRow.lastStatus === 200);
  await db.ontoWebhook.update({ where: { id: hookRow.id }, data: { url: "http://127.0.0.1:9/dead" } });
  const beforeQty = Number(((await db.ontoObject.findUniqueOrThrow({ where: { id: south!.id } })).data as Record<string, unknown>).qty_on_hand);
  const hookBlocked = await executeManufacturingAction(orgId, actor, "mfg_adjust_safety_stock", south!.id, { safetyStock: 78 }, `e2e-hook-block-${Date.now()}`);
  const afterQty = Number(((await db.ontoObject.findUniqueOrThrow({ where: { id: south!.id } })).data as Record<string, unknown>).qty_on_hand);
  check("dead webhook vetoes the write", !hookBlocked.ok && afterQty === beforeQty);
  await db.ontoWebhook.delete({ where: { id: hookRow.id } });
  echo.close();
  const safety = await db.ontoObject.findUniqueOrThrow({ where: { id: south!.id } });
  check("allowed write applied safety stock", Number((safety.data as Record<string, unknown>).safety_stock) === 77);

  // 5. Live agent run over live data -> confirm -> write-back.
  const ctx = await manufacturingAgentContext(orgId, ["mfg_shipment", "mfg_inventory_lot"]);
  check("agent context has nodes", ctx.nodes.length > 0);
  const { llm, provider } = resolveLLM();
  const answer = await runAgent({
    organizationId: orgId,
    actorId: actor,
    question: "which orders are at risk of missing SLA?",
    ctx,
    llm,
    executors: manufacturingToolExecutors,
    provider,
  });
  check("agent proposes a grounded action", answer.proposals.length > 0);
  const evaled = evalAnswer(answer, ctx.nodes.map((n) => n.id));
  check(`agent answer grounded (${evaled.failures.join("; ") || "clean"})`, evaled.ok);
  const proposal = answer.proposals[0]!;
  const confirmReq = await requestApproval(orgId, actor, {
    actionKey: proposal.verb,
    objectId: proposal.objectId,
    inputs: proposal.inputs,
  });
  if (confirmReq.ok) {
    await decideApproval(orgId, confirmReq.value.id, actor, true, "e2e agent confirm");
    const confirmed = await executeManufacturingAction(orgId, actor, proposal.verb, proposal.objectId, proposal.inputs, `e2e-confirm-${Date.now()}`, confirmReq.value.id);
    check("agent proposal confirmed and written back", confirmed.ok);
  } else {
    check("agent proposal confirm requested", false);
  }

  // 6. Audit chain verifies.
  const chain = await verifyEventChain(orgId);
  check(`audit chain verifies (${chain.checked} events)`, chain.ok);

  console.log("e2e done");
}

void main();
