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
let assetId: string;

beforeEach(async () => {
  ctx = await createTestContext();
  app = await buildApp(ctx.deps);
  const auth = await createUserWithToken(ctx);
  token = auth.accessToken;
  userId = auth.userId;
  accountId = auth.accountId!;
  const asset = await ctx.prisma.asset.create({
    data: {
      accountId,
      ownerId: userId,
      originalName: "x.png",
      status: "ready",
      checksum: "abc",
      format: "png",
      sizeBytes: 10,
    },
  });
  assetId = asset.id;
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

describe("GET /api/channels", () => {
  it("lists available channels", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/channels",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((c: { id: string }) => c.id);
    expect(ids).toContain("local-public");
    expect(ids).toContain("webhook");
  });
});

describe("POST /api/assets/:id/publish", () => {
  it("enqueues a publish job per requested channel", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assets/${assetId}/publish`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channelIds: ["local-public", "webhook"] },
    });
    expect(res.statusCode).toBe(202);
    expect(ctx.queue.jobs("publishing")).toEqual([
      { type: "publish-asset", assetId, channelId: "local-public" },
      { type: "publish-asset", assetId, channelId: "webhook" },
    ]);
  });

  it("rejects an unknown channel", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assets/${assetId}/publish`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channelIds: ["nope"] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("forbids publishing another user's asset", async () => {
    const other = await createUserWithToken(ctx);
    const res = await app.inject({
      method: "POST",
      url: `/api/assets/${assetId}/publish`,
      headers: { authorization: `Bearer ${other.accessToken}` },
      payload: { channelIds: ["local-public"] },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/assets/:id/publications", () => {
  it("returns publication history", async () => {
    await ctx.prisma.publication.create({
      data: {
        assetId,
        channelId: "local-public",
        status: "success",
        reference: "http://host/public/" + assetId,
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${assetId}/publications`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].channelId).toBe("local-public");
  });
});

describe("DELETE /api/publications/:id", () => {
  it("removes a publication owned by the user", async () => {
    const pub = await ctx.prisma.publication.create({
      data: { assetId, channelId: "webhook", status: "success" },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/publications/${pub.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect(
      await ctx.prisma.publication.findUnique({ where: { id: pub.id } }),
    ).toBeNull();
  });
});
