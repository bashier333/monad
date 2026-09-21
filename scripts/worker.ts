import { registerQueueHandler, startImportWorker } from "../lib/core/queue";
import { registerManufacturingSchedulerWiring } from "./scheduler-wiring";
import { runScheduledTick } from "../lib/core/scheduler";

registerManufacturingSchedulerWiring();

const SCHEDULER_DELAY_MS = 15 * 60 * 1000;

let lastCheckpointDay = "";

// Daily audit anchor: one checkpoint event per org so verifyTail can
// re-verify the recent segment instead of replaying from genesis. The
// in-memory day guard fits a single worker; multi-worker deployments would
// promote this to a DB-claimed repeatable like the other sweeps.
async function checkpointOnce(): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  if (lastCheckpointDay === day) return;
  lastCheckpointDay = day;
  try {
    const { db } = await import("../lib/core/db");
    const { writeCheckpoint } = await import("../lib/core/ontology/facts");
    const orgs = await db.organization.findMany({ select: { id: true } });
    let anchored = 0;
    for (const o of orgs) {
      const res = await writeCheckpoint(o.id, "worker:scheduler").catch(() => null);
      if (res && res.ok) anchored++;
    }
    console.log(`worker: audit checkpoints anchored for ${anchored}/${orgs.length} orgs`);
  } catch (e) {
    console.log("worker: checkpoint pass failed", e instanceof Error ? e.message : String(e));
  }
}

async function tickOnce(): Promise<void> {
  const res = await runScheduledTick(new Date(), 15, 1).catch((e) => {
    console.log("worker: scheduler tick failed", e instanceof Error ? e.message : String(e));
    return null;
  });
  if (res) {
    const ran = res.playbooks.filter((p) => p.status === "ok").length;
    console.log(`worker: scheduler tick ok (playbooks ${ran}/${res.playbooks.length}, alerts ${res.alerts.length} packs)`);
  }
  await checkpointOnce();
}

async function handleNamedJob(name: string): Promise<boolean> {
  if (name === "scheduler-tick") {
    await tickOnce();
    // Re-enqueue the chain so the tick repeats without cron-style repeaters.
    await enqueueNextTick().catch((e) => {
      console.log("worker: tick re-enqueue skipped", e instanceof Error ? e.message : String(e));
    });
    return true;
  }
  return false;
}

async function enqueueNextTick(): Promise<void> {
  const { Queue } = await import("bullmq");
  if (!process.env.REDIS_URL) return;
  const queue = new Queue("imports", { connection: { url: process.env.REDIS_URL } });
  try {
    await queue.add("scheduler-tick", {}, { jobId: `scheduler-tick-${Date.now()}`, delay: SCHEDULER_DELAY_MS });
  } finally {
    await queue.close();
  }
}

async function main() {
  registerQueueHandler(handleNamedJob);
  const worker = await startImportWorker();
  if (!worker) {
    console.log("worker: in-process mode (set REDIS_URL for BullMQ)");
    await tickOnce();
    const t = setInterval(() => void tickOnce(), SCHEDULER_DELAY_MS);
    t.unref?.();
    console.log("worker: in-process scheduler tick every 15 minutes");
  } else {
    console.log("worker: BullMQ import worker running");
  }
  const sweeps = await startRepeatables().catch((e) => {
    console.log("worker: repeatables skipped", e instanceof Error ? e.message : String(e));
    return null;
  });
  if (sweeps) console.log("worker: repeatable sweeps scheduled (stale runs hourly, retention daily)");
}

async function startRepeatables(): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  // Repeatables (R-534): hourly stale-run sweep + 15-minute scheduler tick via
  // delayed re-enqueue chains.
  const { Queue } = await import("bullmq");
  const queue = new Queue("imports", { connection: { url: process.env.REDIS_URL } });
  await queue.add("sweep-stale", {}, { jobId: `sweep-stale-${Date.now()}`, delay: 60 * 60 * 1000 });
  await enqueueNextTick();
  await queue.close();
  return true;
}

void main();
