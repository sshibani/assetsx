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

    const add = await app.inject({
      method: "POST",
      url: `/api/accounts/${owner.accountId}/members`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { email: "new.member@assetx.local", role: "account_viewer" },
    });
    expect(add.statusCode).toBe(201);
    expect(add.json().email).toBe("new.member@assetx.local");
    expect(add.json().role).toBe("account_viewer");

    const createdMember = await ctx.prisma.user.findUnique({
      where: { email: "new.member@assetx.local" },
    });
    expect(createdMember?.passwordHash).toBeNull();

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/accounts/${owner.accountId}/members/${add.json().id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { role: "account_editor" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().role).toBe("account_editor");
  });

  it("forbids viewers from managing members", async () => {
    const viewer = await createUserWithToken(ctx, { accountRole: "account_viewer" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${viewer.accountId}/members`,
      headers: { authorization: `Bearer ${viewer.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("prevents demoting the last account_owner", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const ownMembership = await ctx.prisma.accountMembership.findFirstOrThrow({
      where: { accountId: owner.accountId!, userId: owner.userId },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/accounts/${owner.accountId}/members/${ownMembership.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { role: "account_editor" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("prevents disabling the last account_owner", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const ownMembership = await ctx.prisma.accountMembership.findFirstOrThrow({
      where: { accountId: owner.accountId!, userId: owner.userId },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/accounts/${owner.accountId}/members/${ownMembership.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { status: "disabled" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("forbids account_editor from managing members", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const editor = await createUserWithToken(ctx, {
      accountRole: "account_editor",
      accountId: owner.accountId!,
    });
    const target = await createUserWithToken(ctx, {
      accountRole: "account_viewer",
      accountId: owner.accountId!,
    });
    const targetMembership = await ctx.prisma.accountMembership.findFirstOrThrow({
      where: { accountId: owner.accountId!, userId: target.userId },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/accounts/${owner.accountId}/members/${targetMembership.id}`,
      headers: { authorization: `Bearer ${editor.accessToken}` },
      payload: { role: "account_viewer" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("lets an owner delete a non-owner member", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const target = await createUserWithToken(ctx, {
      accountRole: "account_viewer",
      accountId: owner.accountId!,
    });
    const targetMembership = await ctx.prisma.accountMembership.findFirstOrThrow({
      where: { accountId: owner.accountId!, userId: target.userId },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/accounts/${owner.accountId}/members/${targetMembership.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(204);
    const gone = await ctx.prisma.accountMembership.findUnique({
      where: { id: targetMembership.id },
    });
    expect(gone).toBeNull();
  });
});

describe("account settings", () => {
  it("returns default settings for an account", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    await ctx.prisma.accountSettings.create({
      data: { accountId: owner.accountId! },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/settings`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().dateTimeFormat).toBe("ISO");
    expect(res.json().timezone).toBe("UTC");
  });

  it("auto-creates settings if missing on read", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/settings`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accountId).toBe(owner.accountId);
  });

  it("lets an owner update settings", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "PUT",
      url: `/api/accounts/${owner.accountId}/settings`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { dateTimeFormat: "EU", timezone: "Europe/Paris" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().dateTimeFormat).toBe("EU");
    expect(res.json().timezone).toBe("Europe/Paris");
  });

  it("rejects an invalid dateTimeFormat", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "PUT",
      url: `/api/accounts/${owner.accountId}/settings`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { dateTimeFormat: "BOGUS" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("forbids viewers from updating settings", async () => {
    const viewer = await createUserWithToken(ctx, { accountRole: "account_viewer" });
    const res = await app.inject({
      method: "PUT",
      url: `/api/accounts/${viewer.accountId}/settings`,
      headers: { authorization: `Bearer ${viewer.accessToken}` },
      payload: { timezone: "UTC" },
    });
    expect(res.statusCode).toBe(403);
  });
});
