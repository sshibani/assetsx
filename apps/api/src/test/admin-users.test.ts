import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  createTestContext,
  createUserWithToken,
  type TestContext,
} from "./test-helpers.js";

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

describe("GET /api/admin/users", () => {
  it("lists all users for a super user", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    await createUserWithToken(ctx, { email: "alice@x.test" });
    await createUserWithToken(ctx, { email: "bob@x.test" });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0]).toHaveProperty("accountCount");
  });

  it("supports email search via ?q=", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    await createUserWithToken(ctx, { email: "needle@x.test" });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=needle",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].email).toBe("needle@x.test");
  });

  it("forbids non-super-users", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/admin/users/:userId", () => {
  it("returns a user with their memberships", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const member = await createUserWithToken(ctx, {
      email: "member@x.test",
      accountRole: "asset_manager",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${member.userId}`,
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe("member@x.test");
    expect(res.json().memberships).toHaveLength(1);
    expect(res.json().memberships[0].role).toBe("asset_manager");
  });

  it("returns 404 for an unknown user", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/admin/users/:userId", () => {
  it("promotes a user to super_user", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const member = await createUserWithToken(ctx, { email: "promote@x.test" });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${member.userId}`,
      headers: { authorization: `Bearer ${superUser.accessToken}` },
      payload: { globalRole: "super_user" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().globalRole).toBe("super_user");
  });

  it("prevents demoting the last super_user", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${superUser.userId}`,
      headers: { authorization: `Bearer ${superUser.accessToken}` },
      payload: { globalRole: "user" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("forbids non-super-users", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const target = await createUserWithToken(ctx, { email: "t@x.test" });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${target.userId}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { globalRole: "super_user" },
    });
    expect(res.statusCode).toBe(403);
  });
});
