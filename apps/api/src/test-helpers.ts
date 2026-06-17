import { execSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { TokenService, hashPassword } from "@assetx/auth";
import { DiskStorageProvider } from "@assetx/storage";
import { SharpImageProcessor } from "@assetx/image-processing";
import { InMemoryJobQueue } from "@assetx/queue";
import {
  ChannelRegistry,
  LocalPublicChannel,
  WebhookChannel,
} from "@assetx/publishing";
import type { AppDependencies } from "./dependencies.js";

const fileURLToPathDir = new URL(".", import.meta.url).pathname;

export interface TestContext {
  deps: AppDependencies;
  prisma: PrismaClient;
  storageRoot: string;
  queue: InMemoryJobQueue;
  cleanup: () => Promise<void>;
}

/** Creates an isolated SQLite DB + temp storage for an integration test. */
export async function createTestContext(): Promise<TestContext> {
  const dir = await mkdtemp(join(tmpdir(), "assetx-api-"));
  const dbPath = join(dir, `test-${randomUUID()}.sqlite`);
  const databaseUrl = `file:${dbPath}`;

  // Apply schema to the fresh DB.
  const schemaPath = join(fileURLToPathDir, "..", "prisma", "schema.prisma");
  execSync(`pnpm exec prisma db push --skip-generate --schema "${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore",
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  const tokens = new TokenService({
    accessSecret: "test-access",
    refreshSecret: "test-refresh",
    accessTtl: "15m",
    refreshTtl: "7d",
  });

  const storageRoot = join(dir, "storage");
  const storage = new DiskStorageProvider({
    root: storageRoot,
    baseUrl: "http://localhost:3001/files",
  });

  const queue = new InMemoryJobQueue();

  const channels = new ChannelRegistry([
    new LocalPublicChannel({ publicBaseUrl: "http://localhost:3001/public" }),
    new WebhookChannel({
      endpoint: "http://localhost:9999/hook",
      fetchFn: async () => ({ ok: true, status: 200 }),
    }),
  ]);

  const deps: AppDependencies = {
    prisma,
    tokens,
    storage,
    processor: new SharpImageProcessor(),
    queue,
    channels,
  };

  return {
    deps,
    prisma,
    storageRoot,
    queue,
    cleanup: async () => {
      await prisma.$disconnect();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** Create a user directly in the DB and return an access token for them. */
export async function createUserWithToken(
  ctx: TestContext,
  options: { email?: string; role?: "admin" | "user" } = {},
): Promise<{ userId: string; accessToken: string }> {
  const email = options.email ?? `user-${randomUUID()}@assetx.local`;
  const role = options.role ?? "user";
  const user = await ctx.prisma.user.create({
    data: { email, passwordHash: await hashPassword("password123"), role },
  });
  const accessToken = ctx.deps.tokens.signAccessToken({
    sub: user.id,
    role,
  });
  return { userId: user.id, accessToken };
}

/** Generate a small valid PNG buffer for upload tests. */
export async function makeTestImage(
  width = 800,
  height = 600,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 144, b: 255 },
    },
  })
    .png()
    .toBuffer();
}

