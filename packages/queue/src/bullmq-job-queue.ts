import { Queue } from "bullmq";
import type { JobPayloadMap, JobQueue, QueueName } from "./types.js";

export interface BullMqConnection {
  host: string;
  port: number;
  password?: string;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/** Production JobQueue backed by BullMQ + Redis. */
export class BullMqJobQueue implements JobQueue {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly connection: BullMqConnection) {}

  private queueFor(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<Q extends QueueName>(
    queue: Q,
    payload: JobPayloadMap[Q],
  ): Promise<void> {
    await this.queueFor(queue).add(payload.type, payload);
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.queues.clear();
  }
}
