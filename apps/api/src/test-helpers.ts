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

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY,"email" TEXT NOT NULL,"passwordHash" TEXT NOT NULL,"role" TEXT NOT NULL DEFAULT 'user',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "RefreshToken" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"tokenHash" TEXT NOT NULL,"expiresAt" DATETIME NOT NULL,"revokedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Asset" ("id" TEXT NOT NULL PRIMARY KEY,"ownerId" TEXT NOT NULL,"originalName" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"checksum" TEXT NOT NULL,"width" INTEGER,"height" INTEGER,"format" TEXT NOT NULL,"sizeBytes" INTEGER NOT NULL,"title" TEXT,"description" TEXT,"altText" TEXT,"tags" TEXT NOT NULL DEFAULT '[]',"metadataSource" TEXT NOT NULL DEFAULT 'manual',"expiresAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Rendition" ("id" TEXT NOT NULL PRIMARY KEY,"assetId" TEXT NOT NULL,"name" TEXT NOT NULL,"storageKey" TEXT NOT NULL,"width" INTEGER NOT NULL,"height" INTEGER NOT NULL,"format" TEXT NOT NULL,"sizeBytes" INTEGER NOT NULL,CONSTRAINT "Rendition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Publication" ("id" TEXT NOT NULL PRIMARY KEY,"assetId" TEXT NOT NULL,"channelId" TEXT NOT NULL,"status" TEXT NOT NULL,"reference" TEXT,"error" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Publication_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Asset_ownerId_idx" ON "Asset"("ownerId")`,
  `CREATE INDEX IF NOT EXISTS "Rendition_assetId_idx" ON "Rendition"("assetId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Rendition_assetId_name_key" ON "Rendition"("assetId", "name")`,
  `CREATE INDEX IF NOT EXISTS "Publication_assetId_idx" ON "Publication"("assetId")`,
];

async function applySchema(prisma: PrismaClient): Promise<void> {
  for (const statement of schemaStatements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

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
  const dbName = `test-${randomUUID()}.sqlite`;
  const databaseUrl = `file:./${dbName}`;

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await applySchema(prisma);

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
      await rm(join(process.cwd(), dbName), { force: true });
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

