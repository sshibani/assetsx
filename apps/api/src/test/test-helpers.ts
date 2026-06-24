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
import { permissionsForAccountRole } from "@assetx/shared-types";
import type { AppDependencies } from "../dependencies.js";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY,"email" TEXT NOT NULL,"passwordHash" TEXT,"globalRole" TEXT NOT NULL DEFAULT 'user',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "Account" ("id" TEXT NOT NULL PRIMARY KEY,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "AccountSettings" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"dateTimeFormat" TEXT NOT NULL DEFAULT 'ISO',"timezone" TEXT NOT NULL DEFAULT 'UTC',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "AccountSettings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "UserIdentity" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"provider" TEXT NOT NULL,"providerSubject" TEXT NOT NULL,"email" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "AccountMembership" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"userId" TEXT NOT NULL,"role" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "RefreshToken" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"accountId" TEXT,"sessionId" TEXT NOT NULL,"identityProvider" TEXT NOT NULL DEFAULT 'local',"tokenHash" TEXT NOT NULL,"expiresAt" DATETIME NOT NULL,"revokedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Asset" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"ownerId" TEXT NOT NULL,"originalName" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"checksum" TEXT NOT NULL,"width" INTEGER,"height" INTEGER,"format" TEXT NOT NULL,"sizeBytes" INTEGER NOT NULL,"title" TEXT,"description" TEXT,"metadataSource" TEXT NOT NULL DEFAULT 'manual',"expiresAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "AssetComment" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"assetId" TEXT NOT NULL,"authorId" TEXT NOT NULL,"body" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "AssetComment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "AssetComment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "AssetComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "AssetActivity" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"assetId" TEXT NOT NULL,"actorId" TEXT,"type" TEXT NOT NULL,"summary" TEXT NOT NULL,"detailsJson" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "AssetActivity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "AssetActivity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "AssetActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Rendition" ("id" TEXT NOT NULL PRIMARY KEY,"assetId" TEXT NOT NULL,"name" TEXT NOT NULL,"storageKey" TEXT NOT NULL,"width" INTEGER NOT NULL,"height" INTEGER NOT NULL,"format" TEXT NOT NULL,"sizeBytes" INTEGER NOT NULL,CONSTRAINT "Rendition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Publication" ("id" TEXT NOT NULL PRIMARY KEY,"assetId" TEXT NOT NULL,"channelId" TEXT NOT NULL,"status" TEXT NOT NULL,"reference" TEXT,"error" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Publication_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Bundle" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"ownerId" TEXT NOT NULL,"title" TEXT NOT NULL,"description" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,CONSTRAINT "Bundle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "Bundle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "BundleAsset" ("id" TEXT NOT NULL PRIMARY KEY,"bundleId" TEXT NOT NULL,"assetId" TEXT NOT NULL,"position" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "BundleAsset_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,CONSTRAINT "BundleAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_slug_key" ON "Account"("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AccountSettings_accountId_key" ON "AccountSettings"("accountId")`,
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
  `CREATE INDEX IF NOT EXISTS "AssetComment_accountId_idx" ON "AssetComment"("accountId")`,
  `CREATE INDEX IF NOT EXISTS "AssetComment_assetId_createdAt_idx" ON "AssetComment"("assetId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AssetComment_authorId_idx" ON "AssetComment"("authorId")`,
  `CREATE INDEX IF NOT EXISTS "AssetActivity_accountId_idx" ON "AssetActivity"("accountId")`,
  `CREATE INDEX IF NOT EXISTS "AssetActivity_assetId_createdAt_idx" ON "AssetActivity"("assetId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AssetActivity_actorId_idx" ON "AssetActivity"("actorId")`,
  `CREATE INDEX IF NOT EXISTS "AssetActivity_type_idx" ON "AssetActivity"("type")`,
  `CREATE INDEX IF NOT EXISTS "Rendition_assetId_idx" ON "Rendition"("assetId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Rendition_assetId_name_key" ON "Rendition"("assetId", "name")`,
  `CREATE INDEX IF NOT EXISTS "Publication_assetId_idx" ON "Publication"("assetId")`,
  `CREATE INDEX IF NOT EXISTS "Bundle_accountId_idx" ON "Bundle"("accountId")`,
  `CREATE INDEX IF NOT EXISTS "Bundle_accountId_createdAt_idx" ON "Bundle"("accountId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Bundle_ownerId_idx" ON "Bundle"("ownerId")`,
  `CREATE INDEX IF NOT EXISTS "BundleAsset_bundleId_idx" ON "BundleAsset"("bundleId")`,
  `CREATE INDEX IF NOT EXISTS "BundleAsset_assetId_idx" ON "BundleAsset"("assetId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "BundleAsset_bundleId_assetId_key" ON "BundleAsset"("bundleId", "assetId")`,
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
    issuer: "assetx-test",
    audience: "assetx-api-test",
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
  options: {
    email?: string;
    role?: "admin" | "user" | "super_user";
    accountRole?: "account_owner" | "account_editor" | "account_viewer";
    accountId?: string;
  } = {},
): Promise<{ userId: string; accountId: string | null; accessToken: string }> {
  const email = options.email ?? `user-${randomUUID()}@assetx.local`;
  const globalRole = options.role === "admin" ? "super_user" : options.role ?? "user";
  const user = await ctx.prisma.user.create({
    data: { email, passwordHash: await hashPassword("password123"), globalRole },
  });
  const account =
    globalRole === "super_user"
      ? null
      : options.accountId
        ? await ctx.prisma.account.findUniqueOrThrow({
            where: { id: options.accountId },
          })
        : await ctx.prisma.account.create({
            data: {
              name: `${email} Account`,
              slug: `acct-${randomUUID()}`,
            },
          });
  if (account) {
    await ctx.prisma.accountMembership.create({
      data: {
        accountId: account.id,
        userId: user.id,
        role: options.accountRole ?? "account_editor",
      },
    });
  }
  const accessToken = ctx.deps.tokens.signAccessToken({
    sub: user.id,
    globalRole,
    accountId: account?.id ?? null,
    accountRole: account ? options.accountRole ?? "account_editor" : null,
    permissions: account
      ? permissionsForAccountRole(options.accountRole ?? "account_editor")
      : ["platform:manage"],
    identityProvider: "local",
    sessionId: randomUUID(),
    authTime: Math.floor(Date.now() / 1000),
  });
  return { userId: user.id, accountId: account?.id ?? null, accessToken };
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

