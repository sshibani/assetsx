import type { JobPayloadMap, JobQueue, QueueName } from "./types.js";

/** Test/dev implementation of JobQueue that records jobs in memory. */
export class InMemoryJobQueue implements JobQueue {
  private readonly store: Record<QueueName, unknown[]> = {
    assets: [],
    publishing: [],
  };

  async enqueue<Q extends QueueName>(
    queue: Q,
    payload: JobPayloadMap[Q],
  ): Promise<void> {
    this.store[queue].push(payload);
  }

  jobs<Q extends QueueName>(queue: Q): JobPayloadMap[Q][] {
    return this.store[queue] as JobPayloadMap[Q][];
  }

  clear(): void {
    this.store.assets = [];
    this.store.publishing = [];
  }

  async close(): Promise<void> {
    this.clear();
  }
}
