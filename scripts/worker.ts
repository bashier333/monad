import { startImportWorker } from "../lib/core/queue";

async function main() {
  const worker = await startImportWorker();
  if (!worker) {
    console.log("worker: in-process mode (set REDIS_URL for BullMQ)");
  } else {
    console.log("worker: BullMQ import worker running");
  }
}

void main();
