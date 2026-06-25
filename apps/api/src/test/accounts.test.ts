import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  createTestContext,
  createUserWithToken,
  makeTestImage,
  type TestContext,
} from "./test-helpers.js";

async function injectLogoUpload(
  app: FastifyInstance,
  accessToken: string,
  accountId: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
) {
  const form = new FormData();
  form.set("file", new Blob([fileBuffer], { type: contentType }), filename);
  const response = new Response(form);
  const body = Buffer.from(await response.arrayBuffer());
  return app.inject({
    method: "POST",
    url: `/api/accounts/${accountId}/logo`,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": response.headers.get("content-type")!,
    },
    payload: body,
  });
}

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

describe("account plan + member last-active metadata", () => {
  it("exposes a default plan on the account DTO", async () => {
    const user = await createUserWithToken(ctx);
    const res = await app.inject({
      method: "GET",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(res.json().items[0].plan).toBe("trial");
  });

  it("records lastActiveAt for a member's membership after an authenticated request", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });

    // before: no activity recorded yet for this membership
    const before = await ctx.prisma.accountMembership.findFirst({
      where: { accountId: owner.accountId!, userId: owner.userId },
    });
    expect(before?.lastActiveAt ?? null).toBeNull();

    // any authenticated, account-scoped request should stamp lastActiveAt
    await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/members`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });

    const after = await ctx.prisma.accountMembership.findFirst({
      where: { accountId: owner.accountId!, userId: owner.userId },
    });
    expect(after?.lastActiveAt).toBeTruthy();
  });

  it("returns lastActiveAt in the members listing", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/members`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const me = res.json().items.find(
      (m: { userId: string }) => m.userId === owner.userId,
    );
    expect(me).toHaveProperty("lastActiveAt");
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

describe("account usage", () => {
  it("returns zero usage and a plan-based quota for an empty account", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/usage`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().usedBytes).toBe(0);
    // trial default quota
    expect(res.json().quotaBytes).toBeGreaterThan(0);
  });

  it("sums asset + rendition bytes for the account", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const asset = await ctx.prisma.asset.create({
      data: {
        accountId: owner.accountId!,
        ownerId: owner.userId,
        originalName: "a.png",
        status: "ready",
        checksum: "x",
        format: "png",
        sizeBytes: 1000,
      },
    });
    await ctx.prisma.rendition.create({
      data: {
        assetId: asset.id,
        name: "thumb",
        storageKey: "k",
        width: 1,
        height: 1,
        format: "webp",
        sizeBytes: 250,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/usage`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().usedBytes).toBe(1250);
  });

  it("lets a super user set an explicit quota that overrides the plan default", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const superUser = await createUserWithToken(ctx, { role: "super_user" });

    const set = await app.inject({
      method: "PUT",
      url: `/api/accounts/${owner.accountId}/quota`,
      headers: { authorization: `Bearer ${superUser.accessToken}` },
      payload: { quotaBytes: 12345 },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().quotaBytes).toBe(12345);

    // reflected in the usage endpoint
    const usage = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/usage`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(usage.json().quotaBytes).toBe(12345);

    // clearing restores the plan default
    const cleared = await app.inject({
      method: "PUT",
      url: `/api/accounts/${owner.accountId}/quota`,
      headers: { authorization: `Bearer ${superUser.accessToken}` },
      payload: { quotaBytes: null },
    });
    expect(cleared.json().quotaBytes).toBeGreaterThan(0);
    expect(cleared.json().quotaBytes).not.toBe(12345);
  });

  it("forbids a non-super-user from setting a quota", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "PUT",
      url: `/api/accounts/${owner.accountId}/quota`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { quotaBytes: 99 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("forbids reading usage for another account", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const other = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/usage`,
      headers: { authorization: `Bearer ${other.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
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
    expect(res.json().brandColor).toBe("#343ced");
    expect(res.json().typeface).toBeNull();
  });

  it("lets an owner update branding (brandColor + typeface)", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "PUT",
      url: `/api/accounts/${owner.accountId}/settings`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { brandColor: "#15803D", typeface: "SF Pro Display" },
    });
    expect(res.statusCode).toBe(200);
    // normalized to lowercase hex
    expect(res.json().brandColor).toBe("#15803d");
    expect(res.json().typeface).toBe("SF Pro Display");
  });

  it("rejects an invalid brandColor", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    for (const bad of ["red", "#12", "343ced", "#1234zz"]) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/accounts/${owner.accountId}/settings`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
        payload: { brandColor: bad },
      });
      expect(res.statusCode).toBe(400);
    }
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

describe("account logo", () => {
  it("returns null logoUrl when no logo is set", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await app.inject({
      method: "GET",
      url: `/api/accounts/${owner.accountId}/settings`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.json().logoUrl).toBeNull();
  });

  it("uploads a workspace logo and exposes logoUrl", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const image = await makeTestImage(64, 64);
    const res = await injectLogoUpload(
      app,
      owner.accessToken,
      owner.accountId!,
      image,
      "logo.png",
      "image/png",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().logoUrl).toContain(
      `/files/accounts/${owner.accountId}/branding/logo`,
    );
    expect(
      await ctx.deps.storage.exists(
        `accounts/${owner.accountId}/branding/logo.png`,
      ),
    ).toBe(true);
  });

  it("rejects a non-image upload", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const res = await injectLogoUpload(
      app,
      owner.accessToken,
      owner.accountId!,
      Buffer.from("not an image"),
      "logo.png",
      "image/png",
    );
    expect(res.statusCode).toBe(400);
  });

  it("removes the logo", async () => {
    const owner = await createUserWithToken(ctx, { accountRole: "account_owner" });
    const image = await makeTestImage(64, 64);
    await injectLogoUpload(
      app,
      owner.accessToken,
      owner.accountId!,
      image,
      "logo.png",
      "image/png",
    );
    const del = await app.inject({
      method: "DELETE",
      url: `/api/accounts/${owner.accountId}/logo`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().logoUrl).toBeNull();
  });

  it("forbids a viewer from uploading a logo", async () => {
    const viewer = await createUserWithToken(ctx, { accountRole: "account_viewer" });
    const image = await makeTestImage(64, 64);
    const res = await injectLogoUpload(
      app,
      viewer.accessToken,
      viewer.accountId!,
      image,
      "logo.png",
      "image/png",
    );
    expect(res.statusCode).toBe(403);
  });
});
