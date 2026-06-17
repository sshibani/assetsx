import { Worker } from "bullmq";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { DiskStorageProvider } from "@assetx/storage";
import { SharpImageProcessor } from "@assetx/image-processing";
import {
  ChannelRegistry,
  LocalPublicChannel,
  WebhookChannel,
} from "@assetx/publishing";
import { JOB_QUEUES, type ProcessAssetJob, type PublishAssetJob } from "@assetx/queue";
import { processAsset } from "./process-asset.js";
import { publishAsset } from "./publish-asset.js";
import type { WorkerDependencies } from "./dependencies.js";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

function storageRoot(): string {
  return resolve(workspaceRoot, process.env.STORAGE_ROOT ?? "./storage-data");
}

function buildDeps(): WorkerDependencies {
  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL ?? "http://localhost:3001/files";
  return {
    prisma: new PrismaClient(),
    storage: new DiskStorageProvider({
      root: storageRoot(),
      baseUrl: publicBaseUrl,
    }),
    processor: new SharpImageProcessor(),
    channels: new ChannelRegistry([
      new LocalPublicChannel({ publicBaseUrl }),
      ...(process.env.WEBHOOK_ENDPOINT
        ? [new WebhookChannel({ endpoint: process.env.WEBHOOK_ENDPOINT })]
        : []),
    ]),
  };
}

function main(): void {
  const deps = buildDeps();
  const connection = {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };

  const assetWorker = new Worker<ProcessAssetJob>(
    JOB_QUEUES.assets,
    async (job) => {
      await processAsset(deps, job.data.assetId);
    },
    { connection },
  );

  const publishWorker = new Worker<PublishAssetJob>(
    JOB_QUEUES.publishing,
    async (job) => {
      await publishAsset(deps, job.data.assetId, job.data.channelId);
    },
    { connection },
  );

  for (const [name, worker] of [
    ["assets", assetWorker],
    ["publishing", publishWorker],
  ] as const) {
    worker.on("failed", (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`[${name}] job ${job?.id} failed:`, err.message);
    });
  }

  // eslint-disable-next-line no-console
  console.log("AssetX worker started; listening for jobs.");

  const shutdown = async () => {
    await Promise.all([assetWorker.close(), publishWorker.close()]);
    await deps.prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
