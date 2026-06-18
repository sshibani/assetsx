import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  createTestContext,
  createUserWithToken,
  makeTestImage,
  type TestContext,
} from "../test-helpers.js";

let ctx: TestContext;
let app: FastifyInstance;
let token: string;
let userId: string;

beforeEach(async () => {
  ctx = await createTestContext();
  app = await buildApp(ctx.deps);
  const auth = await createUserWithToken(ctx);
  token = auth.accessToken;
  userId = auth.userId;
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

async function injectMultipart(
  accessToken: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
) {
  const form = new FormData();
  form.set(
    "file",
    new Blob([fileBuffer], { type: contentType }),
    filename,
  );
  const response = new Response(form);
  const body = Buffer.from(await response.arrayBuffer());
  return app.inject({
    method: "POST",
    url: "/api/assets",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": response.headers.get("content-type")!,
    },
    payload: body,
  });
}

async function uploadImage(
  accessToken: string,
  filename = "photo.png",
  contentType = "image/png",
) {
  const image = await makeTestImage();
  return injectMultipart(accessToken, image, filename, contentType);
}

describe("POST /api/assets", () => {
  it("requires authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/assets" });
    expect(res.statusCode).toBe(401);
  });

  it("uploads an image, persists it as pending and enqueues processing", async () => {
    const res = await uploadImage(token);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("pending");
    expect(body.ownerId).toBe(userId);
    expect(body.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(body.expiresAt).toBeNull();

    // original persisted to storage
    expect(await ctx.deps.storage.exists(`assets/${body.id}/original`)).toBe(true);

    // process-asset job enqueued
    expect(ctx.queue.jobs("assets")).toEqual([
      { type: "process-asset", assetId: body.id },
    ]);
  });

  it("rejects a non-image file (magic-byte check)", async () => {
    const res = await injectMultipart(
      token,
      Buffer.from("not an image"),
      "fake.png",
      "image/png",
    );
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/assets", () => {
  it("lists only the caller's assets", async () => {
    await uploadImage(token);
    const other = await createUserWithToken(ctx);
    await uploadImage(other.accessToken);

    const res = await app.inject({
      method: "GET",
      url: "/api/assets",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].ownerId).toBe(userId);
  });
});

describe("GET /api/assets/:id", () => {
  it("returns the asset with renditions array", async () => {
    const created = (await uploadImage(token)).json();
    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(created.id);
    expect(Array.isArray(res.json().renditions)).toBe(true);
  });

  it("forbids access to another user's asset", async () => {
    const created = (await uploadImage(token)).json();
    const other = await createUserWithToken(ctx);
    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${other.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows an admin to access any asset", async () => {
    const created = (await uploadImage(token)).json();
    const admin = await createUserWithToken(ctx, { role: "admin" });
    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("PATCH /api/assets/:id", () => {
  it("updates editable metadata", async () => {
    const created = (await uploadImage(token)).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "My Title", description: "My Description" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("My Title");
    expect(res.json().description).toBe("My Description");
    expect(res.json()).not.toHaveProperty("altText");
    expect(res.json()).not.toHaveProperty("tags");
  });

  it("sets an optional expiry date at UTC end-of-day", async () => {
    const created = (await uploadImage(token)).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { expiresAt: "2026-06-30" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().expiresAt).toBe("2026-06-30T23:59:59.999Z");
  });

  it("clears an expiry date", async () => {
    const created = (await uploadImage(token)).json();
    await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { expiresAt: "2026-06-30" },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { expiresAt: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().expiresAt).toBeNull();
  });

  it("rejects malformed expiry dates", async () => {
    const created = (await uploadImage(token)).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { expiresAt: "06/30/2026" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid calendar expiry dates", async () => {
    const created = (await uploadImage(token)).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { expiresAt: "2026-02-30" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/assets/:id", () => {
  it("deletes the asset and its stored original", async () => {
    const created = (await uploadImage(token)).json();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect(await ctx.deps.storage.exists(`assets/${created.id}/original`)).toBe(
      false,
    );
    const after = await ctx.prisma.asset.findUnique({ where: { id: created.id } });
    expect(after).toBeNull();
  });
});
