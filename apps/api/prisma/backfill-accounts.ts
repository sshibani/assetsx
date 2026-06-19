import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    name,
  );
  return rows.length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("${table}")`,
  );
  return rows.some((row) => row.name === column);
}

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (!(await columnExists(table, column))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`,
    );
  }
}

async function createTables(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Account" ("id" TEXT NOT NULL PRIMARY KEY,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "UserIdentity" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"provider" TEXT NOT NULL,"providerSubject" TEXT NOT NULL,"email" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AccountMembership" ("id" TEXT NOT NULL PRIMARY KEY,"accountId" TEXT NOT NULL,"userId" TEXT NOT NULL,"role" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );
}

async function createIndexes(): Promise<void> {
  const statements = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "Account_slug_key" ON "Account"("slug")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserIdentity_provider_providerSubject_key" ON "UserIdentity"("provider", "providerSubject")`,
    `CREATE INDEX IF NOT EXISTS "UserIdentity_userId_idx" ON "UserIdentity"("userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "AccountMembership_accountId_userId_key" ON "AccountMembership"("accountId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "AccountMembership_userId_idx" ON "AccountMembership"("userId")`,
    `CREATE INDEX IF NOT EXISTS "AccountMembership_accountId_idx" ON "AccountMembership"("accountId")`,
    `CREATE INDEX IF NOT EXISTS "RefreshToken_accountId_idx" ON "RefreshToken"("accountId")`,
    `CREATE INDEX IF NOT EXISTS "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId")`,
    `CREATE INDEX IF NOT EXISTS "Asset_accountId_idx" ON "Asset"("accountId")`,
    `CREATE INDEX IF NOT EXISTS "Asset_accountId_createdAt_idx" ON "Asset"("accountId", "createdAt")`,
  ];
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function main(): Promise<void> {
  if (!(await tableExists("User"))) {
    return;
  }

  await createTables();

  await addColumnIfMissing("User", "globalRole", "TEXT NOT NULL DEFAULT 'user'");
  if (await columnExists("User", "role")) {
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "globalRole" = CASE WHEN "role" = 'admin' THEN 'super_user' ELSE 'user' END WHERE "globalRole" IS NULL OR "globalRole" = 'user'`,
    );
  }

  await addColumnIfMissing("Asset", "accountId", "TEXT");
  await addColumnIfMissing("RefreshToken", "accountId", "TEXT");
  await addColumnIfMissing("RefreshToken", "sessionId", "TEXT");
  await addColumnIfMissing(
    "RefreshToken",
    "identityProvider",
    "TEXT NOT NULL DEFAULT 'local'",
  );

  const defaultAccountId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Account" ("id", "name", "slug", "status", "createdAt", "updatedAt") VALUES (?, 'Default', 'default', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    defaultAccountId,
  );
  const account = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "Account" WHERE "slug" = 'default' LIMIT 1`,
  );
  const accountId = account[0]?.id ?? defaultAccountId;

  const users = await prisma.$queryRawUnsafe<
    { id: string; email: string; globalRole: string }[]
  >(`SELECT "id", "email", "globalRole" FROM "User"`);
  for (const user of users) {
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "UserIdentity" ("id", "userId", "provider", "providerSubject", "email", "createdAt", "updatedAt") VALUES (?, ?, 'local', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID(),
      user.id,
      user.email.toLowerCase(),
      user.email,
    );
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "AccountMembership" ("id", "accountId", "userId", "role", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID(),
      accountId,
      user.id,
      user.globalRole === "super_user" ? "account_owner" : "asset_manager",
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Asset" SET "accountId" = ? WHERE "accountId" IS NULL`,
    accountId,
  );

  const refreshTokens = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "RefreshToken" WHERE "sessionId" IS NULL`,
  );
  for (const token of refreshTokens) {
    await prisma.$executeRawUnsafe(
      `UPDATE "RefreshToken" SET "sessionId" = ? WHERE "id" = ?`,
      randomUUID(),
      token.id,
    );
  }

  await createIndexes();
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
