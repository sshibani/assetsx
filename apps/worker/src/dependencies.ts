import type { PrismaClient } from "@prisma/client";
import type { StorageProvider } from "@assetx/storage";
import type { ImageProcessor } from "@assetx/image-processing";
import type { ChannelRegistry } from "@assetx/publishing";

export interface WorkerDependencies {
  prisma: PrismaClient;
  storage: StorageProvider;
  processor: ImageProcessor;
  channels: ChannelRegistry;
}
