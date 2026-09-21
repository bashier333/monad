import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { verifyEventChain, verifyTail } from "@/lib/core/ontology/facts";

// GET verifies the full chain from genesis. GET ?tail=1 verifies only the
// segment after the latest checkpoint (falls back to full verify when no
// checkpoint exists). Checkpoints make recent verification O(segment);
// schedule a full pass periodically — tail verification alone cannot catch
// a tampered checkpoint payload, only the main-chain walk can.
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const tail = new URL(req.url).searchParams.get("tail") === "1";
  const res = tail ? await verifyTail(active.organization.id) : await verifyEventChain(active.organization.id);
  await logAccess(active.organization.id, userId, "ontology:audit:verify", `${res.checked}:${res.ok}${tail ? ":tail" : ":full"}`);
  return NextResponse.json(res);
}
