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
import type { WorkerDependencies } from "../dependencies.js";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY,"email" TEXT NOT NULL,"passwordHash" TEXT,"globalRole" TEXT NOT NULL DEFAULT 'user',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "Account" ("id" TEXT NOT NULL PRIMARY KEY,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "UserIdentity" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"provider" TEXT NOT NULL,"providerSubject" TEXT NOT NULL,"email" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "AccountMembership" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"userId" TEXT NOT NULL,"role" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "RefreshToken" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"accountId" TEXT,"sessionId" TEXT NOT NULL,"identityProvider" TEXT NOT NULL DEFAULT 'local',"tokenHash" TEXT NOT NULL,"expiresAt" DATETIME NOT NULL,"revokedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Asset" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"ownerId" TEXT NOT NULL,"originalName" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"checksum" TEXT NOT NULL,"width" INTEGER,"height" INTEGER,"format" TEXT NOT NULL,"sizeBytes" INTEGER NOT NULL,"title" TEXT,"description" TEXT,"metadataSource" TEXT NOT NULL DEFAULT 'manual',"metadataJson" TEXT,"expiresAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Rendition" ("id" TEXT NOT NULL PRIMARY KEY,"assetId" TEXT NOT NULL,"name" TEXT NOT NULL,"storageKey" TEXT NOT NULL,"width" INTEGER NOT NULL,"height" INTEGER NOT NULL,"format" TEXT NOT NULL,"sizeBytes" INTEGER NOT NULL,CONSTRAINT "Rendition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Publication" ("id" TEXT NOT NULL PRIMARY KEY,"assetId" TEXT NOT NULL,"channelId" TEXT NOT NULL,"status" TEXT NOT NULL,"reference" TEXT,"error" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Publication_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_slug_key" ON "Account"("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserIdentity_provider_providerSubject_key" ON "UserIdentity"("provider", "providerSubject")`,
  `CREATE INDEX IF NOT EXISTS "UserIdentity_userId_idx" ON "UserIdentity"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AccountMembership_accountId_userId_key" ON "AccountMembership"("accountId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "AccountMembership_userId_idx" ON "AccountMembership"("userId")`,
  `CREATE INDEX IF NOT EXISTS "AccountMembership_accountId_idx" ON "AccountMembership"("accountId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId")`,
  `CREATE INDEX IF NOT EXISTS "RefreshToken_accountId_idx" ON "RefreshToken"("accountId")`,
  `CREATE INDEX IF NOT EXISTS "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "Asset_accountId_idx" ON "Asset"("accountId")`,
  `CREATE INDEX IF NOT EXISTS "Asset_accountId_createdAt_idx" ON "Asset"("accountId", "createdAt")`,
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

export interface WorkerTestContext {
  deps: WorkerDependencies;
  prisma: PrismaClient;
  storage: DiskStorageProvider;
  webhookCalls: number;
  cleanup: () => Promise<void>;
}

export async function createWorkerTestContext(): Promise<WorkerTestContext> {
  const dir = await mkdtemp(join(tmpdir(), "assetx-worker-"));
  const dbName = `test-${randomUUID()}.sqlite`;
  const databaseUrl = `file:./${dbName}`;

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await applySchema(prisma);
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
      await rm(join(process.cwd(), dbName), { force: true });
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

/** A JPEG with embedded IFD0 EXIF (camera make/model), reliably round-tripped. */
export async function makeTestImageWithExif(): Promise<Buffer> {
  return sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 50, g: 60, b: 70 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: { Make: "Canon", Model: "Canon EOS R5", Software: "AssetX" },
    })
    .toBuffer();
}
