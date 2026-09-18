import type { Queue, Worker } from "bullmq";
import { processImport } from "@/lib/ingest/pipeline";
import { logger } from "@/lib/logger";

export interface ImportJob {
  runId: string;
  requestId: string;
}

function redisUrl(): string | null {
  return process.env.REDIS_URL ?? null;
}

let queue: Queue<ImportJob> | null | undefined;

async function loadBullMQ(): Promise<typeof import("bullmq")> {
  return import("bullmq");
}

export async function getImportQueue(): Promise<Queue<ImportJob> | null> {
  if (queue !== undefined) return queue;
  const url = redisUrl();
  if (!url) {
    queue = null;
    return queue;
  }
  const { Queue: Q } = await loadBullMQ();
  queue = new Q<ImportJob>("imports", {
    connection: { url },
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100 },
  });
  return queue;
}

export async function enqueueImport(job: ImportJob): Promise<"queued" | "inline"> {
  const q = await getImportQueue();
  if (!q) {
    const { enqueue } = await import("@/lib/jobs");
    enqueue(() => processImport(job.runId, job.requestId));
    return "inline";
  }
  await q.add("process-import", job);
  return "queued";
}

export async function startImportWorker(): Promise<Worker<ImportJob> | null> {
  const url = redisUrl();
  if (!url) {
    logger.warn("worker: REDIS_URL unset, no BullMQ worker started (in-process mode)");
    return null;
  }
  const { Worker: W } = await loadBullMQ();
  const worker = new W<ImportJob>(
    "imports",
    async (j) => {
      await processImport(j.data.runId, j.data.requestId);
    },
    { connection: { url }, concurrency: 2 },
  );
  worker.on("failed", (job, err) => {
    logger.error("worker: import job failed", { jobId: job?.id ?? "?", error: String(err) });
  });
  return worker;
}
