import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  createTestContext,
  createUserWithToken,
  type TestContext,
} from "../test-helpers.js";

let ctx: TestContext;
let app: FastifyInstance;

beforeEach(async () => {
  ctx = await createTestContext();
  app = await buildApp(ctx.deps);
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

describe("GET /api/accounts", () => {
  it("lists accounts visible to the current user", async () => {
    const user = await createUserWithToken(ctx);
    const res = await app.inject({
      method: "GET",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].id).toBe(user.accountId);
  });
});

describe("POST /api/accounts", () => {
  it("allows a super user to create an account", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const res = await app.inject({
      method: "POST",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
      payload: { name: "Acme", slug: "acme" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe("acme");

    const membership = await ctx.prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: res.json().id,
          userId: superUser.userId,
        },
      },
    });
    expect(membership?.role).toBe("account_owner");
  });

  it("forbids normal users from creating accounts", async () => {
    const user = await createUserWithToken(ctx);
    const res = await app.inject({
      method: "POST",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: "Acme", slug: "acme" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("account memberships", () => {
  it("allows an account owner to add and update a member", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const member = await createUserWithToken(ctx);

    const add = await app.inject({
      method: "POST",
      url: `/api/accounts/${owner.accountId}/members`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { email: `user-${member.userId}@assetx.local`, role: "asset_viewer" },
    });
    expect(add.statusCode).toBe(404);

    const actualMember = await ctx.prisma.user.findUnique({
      where: { id: member.userId },
    });
    const added = await app.inject({
      method: "POST",
      url: `/api/accounts/${owner.accountId}/members`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { email: actualMember!.email, role: "asset_viewer" },
    });
    expect(added.statusCode).toBe(201);
    expect(added.json().role).toBe("asset_viewer");

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/accounts/${owner.accountId}/members/${added.json().id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { role: "asset_manager" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().role).toBe("asset_manager");
  });

  it("forbids viewers from managing members", async () => {
    const viewer = await createUserWithToken(ctx, { accountRole: "asset_viewer" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${viewer.accountId}/members`,
      headers: { authorization: `Bearer ${viewer.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
