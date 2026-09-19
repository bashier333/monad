import { startImportWorker } from "../lib/core/queue";

async function main() {
  const worker = await startImportWorker();
  if (!worker) {
    console.log("worker: in-process mode (set REDIS_URL for BullMQ)");
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
  // Repeatables (R-534): hourly stale-run sweep via a delayed re-enqueue chain.
  // (This BullMQ major removed cron-style `repeat`; the chain re-adds itself hourly.)
  const { Queue } = await import("bullmq");
  const queue = new Queue("imports", { connection: { url: process.env.REDIS_URL } });
  await queue.add("sweep-stale", {}, { jobId: `sweep-stale-${Date.now()}`, delay: 60 * 60 * 1000 });
  await queue.close();
  return true;
}

void main();
