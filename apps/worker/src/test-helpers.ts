import { execSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { DiskStorageProvider } from "@assetx/storage";
import { SharpImageProcessor } from "@assetx/image-processing";
import {
  ChannelRegistry,
  LocalPublicChannel,
  WebhookChannel,
} from "@assetx/publishing";
import type { WorkerDependencies } from "./dependencies.js";

const schemaPath = join(
  new URL(".", import.meta.url).pathname,
  "..",
  "..",
  "api",
  "prisma",
  "schema.prisma",
);

export interface WorkerTestContext {
  deps: WorkerDependencies;
  prisma: PrismaClient;
  storage: DiskStorageProvider;
  webhookCalls: number;
  cleanup: () => Promise<void>;
}

export async function createWorkerTestContext(): Promise<WorkerTestContext> {
  const dir = await mkdtemp(join(tmpdir(), "assetx-worker-"));
  const databaseUrl = `file:${join(dir, `test-${randomUUID()}.sqlite`)}`;

  execSync(`pnpm exec prisma db push --skip-generate --schema "${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore",
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const storage = new DiskStorageProvider({
    root: join(dir, "storage"),
    baseUrl: "http://localhost:3001/files",
  });

  const ctx: { webhookCalls: number } = { webhookCalls: 0 };
  const channels = new ChannelRegistry([
    new LocalPublicChannel({ publicBaseUrl: "http://localhost:3001/public" }),
    new WebhookChannel({
      endpoint: "http://localhost:9999/hook",
      fetchFn: async () => {
        ctx.webhookCalls += 1;
        return { ok: true, status: 200 };
      },
    }),
  ]);

  const deps: WorkerDependencies = {
    prisma,
    storage,
    processor: new SharpImageProcessor(),
    channels,
  };

  return {
    deps,
    prisma,
    storage,
    get webhookCalls() {
      return ctx.webhookCalls;
    },
    cleanup: async () => {
      await prisma.$disconnect();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function makeTestImage(width = 3000, height = 2000): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg()
    .toBuffer();
}
