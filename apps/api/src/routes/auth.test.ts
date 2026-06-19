import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { createTestContext, type TestContext } from "../test-helpers.js";
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
