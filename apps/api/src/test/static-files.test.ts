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

beforeEach(async () => {
  ctx = await createTestContext();
  // Serve stored files at /files/* from the test storage root.
  app = await buildApp(ctx.deps, { staticRoot: ctx.storageRoot });
  token = (await createUserWithToken(ctx)).accessToken;
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

async function uploadImage() {
  const image = await makeTestImage();
  const form = new FormData();
  form.set("file", new Blob([image], { type: "image/png" }), "photo.png");
  const response = new Response(form);
  const body = Buffer.from(await response.arrayBuffer());
  return app.inject({
    method: "POST",
    url: "/api/assets",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": response.headers.get("content-type")!,
    },
    payload: body,
  });
}

describe("GET /files/* (stored file serving)", () => {
  it("serves a stored original at the storage key path", async () => {
    const asset = (await uploadImage()).json();

    const res = await app.inject({
      method: "GET",
      url: `/files/assets/${asset.id}/original`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.byteLength).toBeGreaterThan(0);
  });

  it("returns 404 for a missing file", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/files/assets/does-not-exist/thumb.webp",
    });
    expect(res.statusCode).toBe(404);
  });
});
