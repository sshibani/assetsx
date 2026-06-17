import type { PrismaClient } from "@prisma/client";
import type { TokenService } from "@assetx/auth";
import type { StorageProvider } from "@assetx/storage";
import type { ImageProcessor } from "@assetx/image-processing";
import type { JobQueue } from "@assetx/queue";
import type { ChannelRegistry } from "@assetx/publishing";

/**
 * All external collaborators the route handlers depend on. Injected at
 * app-build time so integration tests can supply fakes (in-memory queue,
 * temp-dir storage, etc.).
 */
export interface AppDependencies {
  prisma: PrismaClient;
  tokens: TokenService;
  storage: StorageProvider;
  processor: ImageProcessor;
  queue: JobQueue;
  channels: ChannelRegistry;
}
