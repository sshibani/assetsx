export const JOB_QUEUES = {
  assets: "assets",
  publishing: "publishing",
} as const;

export type QueueName = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES];

/** Payload for the `process-asset` job on the `assets` queue. */
export interface ProcessAssetJob {
  type: "process-asset";
  assetId: string;
}

/** Payload for the `publish-asset` job on the `publishing` queue. */
export interface PublishAssetJob {
  type: "publish-asset";
  assetId: string;
  channelId: string;
}

export type JobPayloadMap = {
  assets: ProcessAssetJob;
  publishing: PublishAssetJob;
};

/**
 * Minimal queue abstraction the API/worker depend on, so business logic
 * never imports BullMQ directly. Implemented by BullMqJobQueue (prod) and
 * InMemoryJobQueue (tests).
 */
export interface JobQueue {
  enqueue<Q extends QueueName>(queue: Q, payload: JobPayloadMap[Q]): Promise<void>;
  close(): Promise<void>;
}
