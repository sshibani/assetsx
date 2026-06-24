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

describe("GET /api/admin/accounts", () => {
  it("lists all accounts with member counts for a super user", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    // add a second member to the owner's account
    await createUserWithToken(ctx, {
      accountRole: "account_viewer",
      accountId: owner.accountId!,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/accounts",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    const target = items.find(
      (a: { id: string }) => a.id === owner.accountId,
    );
    expect(target.memberCount).toBe(2);
    expect(target).toHaveProperty("name");
    expect(target).toHaveProperty("slug");
    expect(target).toHaveProperty("status");
  });

  it("includes disabled accounts", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    const disabled = await ctx.prisma.account.create({
      data: { name: "Disabled Co", slug: "disabled-co", status: "disabled" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/accounts",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((a: { id: string }) => a.id);
    expect(ids).toContain(disabled.id);
  });

  it("supports name/slug search via ?q=", async () => {
    const superUser = await createUserWithToken(ctx, { role: "super_user" });
    await ctx.prisma.account.create({
      data: { name: "Needle Inc", slug: "needle-inc" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/accounts?q=needle",
      headers: { authorization: `Bearer ${superUser.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].slug).toBe("needle-inc");
  });

  it("forbids non-super-users", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/accounts",
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
