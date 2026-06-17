import { PrismaClient } from "@prisma/client";
import { TokenService } from "@assetx/auth";
import { DiskStorageProvider } from "@assetx/storage";
import { SharpImageProcessor } from "@assetx/image-processing";
import { BullMqJobQueue } from "@assetx/queue";
import {
  ChannelRegistry,
  LocalPublicChannel,
  WebhookChannel,
} from "@assetx/publishing";
import type { AppConfig } from "./config.js";
import type { AppDependencies } from "./dependencies.js";

/** Wire up production collaborators from config. */
export function buildDependencies(config: AppConfig): AppDependencies {
  const prisma = new PrismaClient();

  const tokens = new TokenService({
    accessSecret: config.jwt.accessSecret,
    refreshSecret: config.jwt.refreshSecret,
    accessTtl: config.jwt.accessTtl as `${number}m`,
    refreshTtl: config.jwt.refreshTtl as `${number}d`,
  });

  const storage = new DiskStorageProvider({
    root: config.storage.root,
    baseUrl: config.storage.publicBaseUrl,
  });

  const queue = new BullMqJobQueue({
    host: config.redis.host,
    port: config.redis.port,
  });

  const channels = new ChannelRegistry([
    new LocalPublicChannel({ publicBaseUrl: config.storage.publicBaseUrl }),
    ...(process.env.WEBHOOK_ENDPOINT
      ? [new WebhookChannel({ endpoint: process.env.WEBHOOK_ENDPOINT })]
      : []),
  ]);

  return {
    prisma,
    tokens,
    storage,
    processor: new SharpImageProcessor(),
    queue,
    channels,
  };
}
