import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { createTestContext, type TestContext } from "./test-helpers.js";
import { hashPassword } from "@assetx/auth";

let ctx: TestContext;
let app: FastifyInstance;

beforeEach(async () => {
  ctx = await createTestContext();
  app = await buildApp(ctx.deps);
  // Seed a super user with an account used by several tests.
  const user = await ctx.prisma.user.create({
    data: {
      email: "admin@assetx.local",
      passwordHash: await hashPassword("admin12345"),
      globalRole: "super_user",
    },
  });
  const account = await ctx.prisma.account.create({
    data: { name: "Admin Account", slug: "admin-account" },
  });
  await ctx.prisma.accountMembership.create({
    data: {
      accountId: account.id,
      userId: user.id,
      role: "account_owner",
    },
  });
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

describe("POST /api/auth/signup", () => {
  it("creates an account + owner user and returns tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: {
        accountName: "Acme Corp",
        email: "founder@acme.test",
        password: "password123",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe("founder@acme.test");
    expect(body.user.globalRole).toBe("user");
    expect(body.accounts).toHaveLength(1);
    expect(body.activeAccount.account.name).toBe("Acme Corp");
    expect(body.activeAccount.membership.role).toBe("account_owner");

    // settings row created with defaults
    const settings = await ctx.prisma.accountSettings.findUnique({
      where: { accountId: body.activeAccount.account.id },
    });
    expect(settings?.dateTimeFormat).toBe("ISO");
    expect(settings?.timezone).toBe("UTC");
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: {
        accountName: "Dup",
        email: "admin@assetx.local",
        password: "password123",
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it("validates the request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { accountName: "", email: "bad", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("generates unique slugs for accounts with the same name", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { accountName: "Same Name", email: "a@x.test", password: "password123" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { accountName: "Same Name", email: "b@x.test", password: "password123" },
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().activeAccount.account.slug).not.toBe(
      second.json().activeAccount.account.slug,
    );
  });
});

describe("POST /api/auth/login", () => {
  it("returns access + refresh tokens for valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.globalRole).toBe("super_user");
    expect(body.accounts).toHaveLength(1);
  });

  it("rejects invalid credentials with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("validates the request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("super user account visibility", () => {
  it("login returns ALL active accounts for a super user", async () => {
    // Two extra accounts the super user is NOT a member of.
    await ctx.prisma.account.create({
      data: { name: "Other A", slug: "other-a" },
    });
    await ctx.prisma.account.create({
      data: { name: "Other B", slug: "other-b" },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    expect(login.statusCode).toBe(200);
    // Admin Account (member) + Other A + Other B = 3
    expect(login.json().accounts).toHaveLength(3);
  });

  it("GET /api/auth/me returns ALL active accounts for a super user", async () => {
    await ctx.prisma.account.create({
      data: { name: "Other C", slug: "other-c" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    const { accessToken } = login.json();

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accounts).toHaveLength(2);
  });

  it("lets a super user switch into an account they are not a member of", async () => {
    const other = await ctx.prisma.account.create({
      data: { name: "Not A Member", slug: "not-a-member" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    const { accessToken } = login.json();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/switch-account",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accountId: other.id },
    });
    expect(res.statusCode).toBe(200);
    // The active account context must be populated, not null.
    expect(res.json().activeAccount).not.toBeNull();
    expect(res.json().activeAccount.account.id).toBe(other.id);
  });

  it("excludes disabled accounts from a super user's list", async () => {
    await ctx.prisma.account.create({
      data: { name: "Disabled", slug: "disabled-acct", status: "disabled" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    // Only Admin Account is active.
    expect(login.json().accounts).toHaveLength(1);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user with a valid token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    const { accessToken } = login.json();

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe("admin@assetx.local");
    expect(res.json().globalRole).toBe("super_user");
  });

  it("rejects requests without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates tokens given a valid refresh token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    const { refreshToken } = login.json();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    expect(res.json().refreshToken).toBeTruthy();
  });

  it("rejects a reused (revoked) refresh token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@assetx.local", password: "admin12345" },
    });
    const { refreshToken } = login.json();

    await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });
    // second use of the same token must fail
    const reuse = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });
});
