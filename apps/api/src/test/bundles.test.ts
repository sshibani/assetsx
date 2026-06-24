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
let token: string;
let userId: string;
let accountId: string;

beforeEach(async () => {
  ctx = await createTestContext();
  app = await buildApp(ctx.deps);
  const auth = await createUserWithToken(ctx);
  token = auth.accessToken;
  userId = auth.userId;
  accountId = auth.accountId!;
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

function authHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

async function createBundle(
  accessToken: string,
  body: { title: string; description?: string },
) {
  return app.inject({
    method: "POST",
    url: "/api/bundles",
    headers: authHeaders(accessToken),
    payload: body,
  });
}

/** Insert an asset directly in the DB for the given account. */
async function seedAsset(
  ownerId: string,
  ownerAccountId: string,
  overrides: { originalName?: string } = {},
) {
  return ctx.prisma.asset.create({
    data: {
      accountId: ownerAccountId,
      ownerId,
      originalName: overrides.originalName ?? "photo.png",
      status: "ready",
      checksum: "a".repeat(64),
      format: "png",
      sizeBytes: 1234,
    },
  });
}

describe("POST /api/bundles", () => {
  it("requires authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/bundles" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a bundle scoped to the account", async () => {
    const res = await createBundle(token, {
      title: "Spring campaign",
      description: "Hero shots",
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe("Spring campaign");
    expect(body.description).toBe("Hero shots");
    expect(body.accountId).toBe(accountId);
    expect(body.ownerId).toBe(userId);
    expect(body.assetCount).toBe(0);
  });

  it("rejects an empty title", async () => {
    const res = await createBundle(token, { title: "" });
    expect(res.statusCode).toBe(400);
  });

  it("forbids viewers (bundles:create not granted)", async () => {
    const viewer = await createUserWithToken(ctx, {
      accountRole: "account_viewer",
      accountId,
    });
    const res = await createBundle(viewer.accessToken, { title: "Nope" });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/bundles", () => {
  it("lists bundles for the account only", async () => {
    await createBundle(token, { title: "A" });
    await createBundle(token, { title: "B" });

    // a bundle in another account must not leak
    const other = await createUserWithToken(ctx, {
      email: "other@assetx.local",
    });
    await createBundle(other.accessToken, { title: "Other" });

    const res = await app.inject({
      method: "GET",
      url: "/api/bundles",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const { items } = res.json();
    expect(items).toHaveLength(2);
    expect(items.map((b: { title: string }) => b.title).sort()).toEqual([
      "A",
      "B",
    ]);
  });
});

describe("GET /api/bundles/:id", () => {
  it("returns the bundle with hydrated, ordered assets", async () => {
    const created = (await createBundle(token, { title: "Detail" })).json();
    const a1 = await seedAsset(userId, accountId, { originalName: "one.png" });
    const a2 = await seedAsset(userId, accountId, { originalName: "two.png" });

    await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: a2.id, position: 1 },
    });
    await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: a1.id, position: 0 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/bundles/${created.id}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assetCount).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].position).toBe(0);
    expect(body.items[0].assetId).toBe(a1.id);
    expect(body.items[0].asset.originalName).toBe("one.png");
    expect(body.items[1].assetId).toBe(a2.id);
  });

  it("returns 404 for an unknown bundle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/bundles/does-not-exist",
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("forbids cross-account access", async () => {
    const created = (await createBundle(token, { title: "Mine" })).json();
    const other = await createUserWithToken(ctx, {
      email: "intruder@assetx.local",
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/bundles/${created.id}`,
      headers: authHeaders(other.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/assets/:id/bundles", () => {
  it("lists the bundles that contain the asset", async () => {
    const inA = (await createBundle(token, { title: "In A" })).json();
    const inB = (await createBundle(token, { title: "In B" })).json();
    await createBundle(token, { title: "Not in" });
    const asset = await seedAsset(userId, accountId);

    for (const b of [inA, inB]) {
      await app.inject({
        method: "POST",
        url: `/api/bundles/${b.id}/assets`,
        headers: authHeaders(token),
        payload: { assetId: asset.id },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${asset.id}/bundles`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const { items } = res.json();
    expect(items.map((b: { title: string }) => b.title).sort()).toEqual([
      "In A",
      "In B",
    ]);
  });

  it("returns an empty list when the asset is in no bundles", async () => {
    const asset = await seedAsset(userId, accountId);
    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${asset.id}/bundles`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });

  it("forbids cross-account access", async () => {
    const asset = await seedAsset(userId, accountId);
    const other = await createUserWithToken(ctx, {
      email: "peek@assetx.local",
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${asset.id}/bundles`,
      headers: authHeaders(other.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/bundles/:id", () => {
  it("updates title and description", async () => {
    const created = (await createBundle(token, { title: "Old" })).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/bundles/${created.id}`,
      headers: authHeaders(token),
      payload: { title: "New", description: "Now described" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("New");
    expect(body.description).toBe("Now described");
  });
});

describe("DELETE /api/bundles/:id", () => {
  it("deletes the bundle and cascades join rows", async () => {
    const created = (await createBundle(token, { title: "Temp" })).json();
    const asset = await seedAsset(userId, accountId);
    await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: asset.id },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/bundles/${created.id}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(204);

    expect(
      await ctx.prisma.bundle.findUnique({ where: { id: created.id } }),
    ).toBeNull();
    expect(
      await ctx.prisma.bundleAsset.count({ where: { bundleId: created.id } }),
    ).toBe(0);
  });
});

describe("POST /api/bundles/:id/assets", () => {
  it("adds an asset to the bundle", async () => {
    const created = (await createBundle(token, { title: "Add" })).json();
    const asset = await seedAsset(userId, accountId);
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: asset.id },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.assetCount).toBe(1);
  });

  it("rejects a duplicate add with 409", async () => {
    const created = (await createBundle(token, { title: "Dup" })).json();
    const asset = await seedAsset(userId, accountId);
    await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: asset.id },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: asset.id },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 404 when the asset does not exist", async () => {
    const created = (await createBundle(token, { title: "Missing" })).json();
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: "nope" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects adding an asset from another account", async () => {
    const created = (await createBundle(token, { title: "Scoped" })).json();
    const other = await createUserWithToken(ctx, {
      email: "owner2@assetx.local",
    });
    const foreignAsset = await seedAsset(other.userId, other.accountId!);
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: foreignAsset.id },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/bundles/:id/assets/:assetId", () => {
  it("removes an asset from the bundle", async () => {
    const created = (await createBundle(token, { title: "Remove" })).json();
    const asset = await seedAsset(userId, accountId);
    await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: asset.id },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/bundles/${created.id}/assets/${asset.id}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(204);
    expect(
      await ctx.prisma.bundleAsset.count({ where: { bundleId: created.id } }),
    ).toBe(0);
  });

  it("returns 404 when the asset is not in the bundle", async () => {
    const created = (await createBundle(token, { title: "Empty" })).json();
    const asset = await seedAsset(userId, accountId);
    const res = await app.inject({
      method: "DELETE",
      url: `/api/bundles/${created.id}/assets/${asset.id}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/bundles/:id/share", () => {
  it("creates a share and returns a one-time token + url", async () => {
    const created = (await createBundle(token, { title: "Shared" })).json();
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/share`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(20);
    expect(body.url).toContain(body.token);
    expect(body.bundleId).toBe(created.id);
    expect(body.revokedAt).toBeNull();

    // only the hash is stored, never the raw token
    const stored = await ctx.prisma.bundleShare.findUnique({
      where: { id: body.id },
    });
    expect(stored).not.toBeNull();
    expect(stored!.tokenHash).not.toBe(body.token);
  });

  it("forbids users without bundles:share (viewer)", async () => {
    const created = (await createBundle(token, { title: "NoShare" })).json();
    const viewer = await createUserWithToken(ctx, {
      accountRole: "account_viewer",
      accountId,
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/share`,
      headers: authHeaders(viewer.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it("forbids cross-account sharing", async () => {
    const created = (await createBundle(token, { title: "Mine" })).json();
    const other = await createUserWithToken(ctx, {
      email: "outsider@assetx.local",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/share`,
      headers: authHeaders(other.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/bundles/:id/share/:shareId", () => {
  it("revokes a share", async () => {
    const created = (await createBundle(token, { title: "Revoke" })).json();
    const share = (
      await app.inject({
        method: "POST",
        url: `/api/bundles/${created.id}/share`,
        headers: authHeaders(token),
        payload: {},
      })
    ).json();

    const res = await app.inject({
      method: "DELETE",
      url: `/api/bundles/${created.id}/share/${share.id}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(204);
    const stored = await ctx.prisma.bundleShare.findUnique({
      where: { id: share.id },
    });
    expect(stored!.revokedAt).not.toBeNull();
  });
});

describe("GET /api/shared/bundles/:token (public)", () => {
  it("returns the bundle read-only without authentication", async () => {
    const created = (await createBundle(token, { title: "Public" })).json();
    const asset = await seedAsset(userId, accountId, {
      originalName: "shared.png",
    });
    await app.inject({
      method: "POST",
      url: `/api/bundles/${created.id}/assets`,
      headers: authHeaders(token),
      payload: { assetId: asset.id },
    });
    const share = (
      await app.inject({
        method: "POST",
        url: `/api/bundles/${created.id}/share`,
        headers: authHeaders(token),
        payload: {},
      })
    ).json();

    // no auth header
    const res = await app.inject({
      method: "GET",
      url: `/api/shared/bundles/${share.token}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("Public");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].asset.originalName).toBe("shared.png");
    // must not leak internal ids
    expect(body.accountId).toBeUndefined();
  });

  it("returns 404 for an unknown token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/shared/bundles/nonexistent-token",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for a revoked token", async () => {
    const created = (await createBundle(token, { title: "Revoked" })).json();
    const share = (
      await app.inject({
        method: "POST",
        url: `/api/bundles/${created.id}/share`,
        headers: authHeaders(token),
        payload: {},
      })
    ).json();
    await app.inject({
      method: "DELETE",
      url: `/api/bundles/${created.id}/share/${share.id}`,
      headers: authHeaders(token),
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/shared/bundles/${share.token}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for an expired token", async () => {
    const created = (await createBundle(token, { title: "Expired" })).json();
    const share = (
      await app.inject({
        method: "POST",
        url: `/api/bundles/${created.id}/share`,
        headers: authHeaders(token),
        payload: { expiresInDays: 7 },
      })
    ).json();
    // force expiry in the past
    await ctx.prisma.bundleShare.update({
      where: { id: share.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/shared/bundles/${share.token}`,
    });
    expect(res.statusCode).toBe(404);
  });
});
