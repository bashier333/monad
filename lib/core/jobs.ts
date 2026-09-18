import { logger } from "@/lib/core/logger";

type Job = () => Promise<void>;

const queue: Job[] = [];
let running = false;

async function pump() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) continue;
    try {
      await job();
    } catch (e) {
      logger.error("background job failed", { error: String(e) });
    }
  }
  running = false;
}

export function enqueue(job: Job): void {
  queue.push(job);
  void pump();
}
