import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  createTestContext,
  createUserWithToken,
  makeTestImage,
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

function makeTestPdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  );
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
    expect(body.originalUrl).toContain(`/files/assets/${body.id}/original`);

    // original persisted to storage
    expect(await ctx.deps.storage.exists(`assets/${body.id}/original`)).toBe(true);

    // process-asset job enqueued
    expect(ctx.queue.jobs("assets")).toEqual([
      { type: "process-asset", assetId: body.id },
    ]);
  });

  it("uploads a PDF, persists it as pending and enqueues processing", async () => {
    const res = await injectMultipart(
      token,
      makeTestPdf(),
      "document.pdf",
      "application/pdf",
    );
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("pending");
    expect(body.originalName).toBe("document.pdf");
    expect(body.format).toBe("pdf");
    expect(body.width).toBeNull();
    expect(body.height).toBeNull();
    expect(body.renditions).toEqual([]);
    expect(body.originalUrl).toContain(`/files/assets/${body.id}/original`);
    expect(await ctx.deps.storage.exists(`assets/${body.id}/original`)).toBe(true);
    expect(ctx.queue.jobs("assets")).toEqual([
      { type: "process-asset", assetId: body.id },
    ]);

    const activity = await ctx.prisma.assetActivity.findFirst({
      where: { assetId: body.id, type: "asset.created" },
    });
    expect(activity?.actorId).toBe(userId);
    expect(activity?.summary).toBe("Asset created");
  });

  it("rejects an unsupported file (magic-byte check)", async () => {
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
    // metadata is null until the worker extracts it
    expect(res.json().metadata).toBeNull();
  });

  it("exposes extracted metadata from metadataJson in the DTO", async () => {
    const created = (await uploadImage(token)).json();
    const metadata = {
      cameraMake: "Canon",
      cameraModel: "EOS R5",
      gps: { lat: 52.37, lng: 4.9, altitude: null },
    };
    await ctx.prisma.asset.update({
      where: { id: created.id },
      data: { metadataJson: JSON.stringify(metadata) },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.metadata.cameraMake).toBe("Canon");
    expect(body.metadata.gps.lat).toBeCloseTo(52.37, 2);
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

    const activity = await ctx.prisma.assetActivity.findFirst({
      where: { assetId: created.id, type: "asset.updated" },
    });
    expect(activity?.actorId).toBe(userId);
    expect(activity?.summary).toBe("Asset metadata updated");
    expect(JSON.parse(activity!.detailsJson!).changedFields).toEqual([
      "title",
      "description",
    ]);
  });

  it("does not log update activity when metadata does not change", async () => {
    const created = (await uploadImage(token)).json();
    await app.inject({
      method: "PATCH",
      url: `/api/assets/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: null },
    });
    const updates = await ctx.prisma.assetActivity.findMany({
      where: { assetId: created.id, type: "asset.updated" },
    });
    expect(updates).toHaveLength(0);
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

describe("asset comments and activity", () => {
  it("returns a timeline with create activity and comments", async () => {
    const created = (await uploadImage(token)).json();
    const commentRes = await app.inject({
      method: "POST",
      url: `/api/assets/${created.id}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: " Looks good to me. " },
    });
    expect(commentRes.statusCode).toBe(201);
    expect(commentRes.json().kind).toBe("comment");
    expect(commentRes.json().comment.body).toBe("Looks good to me.");

    const timelineRes = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}/timeline`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(timelineRes.statusCode).toBe(200);
    const items = timelineRes.json().items;
    expect(items.map((item: { kind: string }) => item.kind)).toContain("comment");
    expect(
      items.some(
        (item: { kind: string; activity?: { type: string } }) =>
          item.kind === "activity" && item.activity?.type === "asset.created",
      ),
    ).toBe(true);
  });

  it("rejects empty and overlong comments", async () => {
    const created = (await uploadImage(token)).json();
    const empty = await app.inject({
      method: "POST",
      url: `/api/assets/${created.id}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: "   " },
    });
    expect(empty.statusCode).toBe(400);

    const overlong = await app.inject({
      method: "POST",
      url: `/api/assets/${created.id}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: "x".repeat(2001) },
    });
    expect(overlong.statusCode).toBe(400);
  });

  it("allows viewers to read timeline but not create comments", async () => {
    const created = (await uploadImage(token)).json();
    const viewer = await createUserWithToken(ctx, {
      accountId,
      accountRole: "account_viewer",
    });

    const timelineRes = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}/timeline`,
      headers: { authorization: `Bearer ${viewer.accessToken}` },
    });
    expect(timelineRes.statusCode).toBe(200);

    const commentRes = await app.inject({
      method: "POST",
      url: `/api/assets/${created.id}/comments`,
      headers: { authorization: `Bearer ${viewer.accessToken}` },
      payload: { body: "Viewer comment" },
    });
    expect(commentRes.statusCode).toBe(403);
  });

  it("forbids timeline and comments across accounts", async () => {
    const created = (await uploadImage(token)).json();
    const other = await createUserWithToken(ctx);

    const timelineRes = await app.inject({
      method: "GET",
      url: `/api/assets/${created.id}/timeline`,
      headers: { authorization: `Bearer ${other.accessToken}` },
    });
    expect(timelineRes.statusCode).toBe(403);

    const commentRes = await app.inject({
      method: "POST",
      url: `/api/assets/${created.id}/comments`,
      headers: { authorization: `Bearer ${other.accessToken}` },
      payload: { body: "Cross-account comment" },
    });
    expect(commentRes.statusCode).toBe(403);
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
