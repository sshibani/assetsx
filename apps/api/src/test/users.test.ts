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

beforeEach(async () => {
  ctx = await createTestContext();
  app = await buildApp(ctx.deps);
  const auth = await createUserWithToken(ctx, { accountRole: "account_editor" });
  token = auth.accessToken;
  userId = auth.userId;
});

afterEach(async () => {
  await app.close();
  await ctx.cleanup();
});

async function injectAvatar(buffer: Buffer, filename: string, contentType: string) {
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: contentType }), filename);
  const response = new Response(form);
  const body = Buffer.from(await response.arrayBuffer());
  return app.inject({
    method: "POST",
    url: "/api/users/me/avatar",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": response.headers.get("content-type")!,
    },
    payload: body,
  });
}

describe("GET /api/users/me", () => {
  it("requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the current user with locale + avatarUrl", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(userId);
    expect(res.json().locale).toBe("en");
    expect(res.json().avatarUrl).toBeNull();
  });
});

describe("PATCH /api/users/me", () => {
  it("updates the user's locale", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: "nl" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().locale).toBe("nl");
  });

  it("rejects an invalid locale", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: "fr" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("user avatar", () => {
  it("uploads and exposes avatarUrl, then removes it", async () => {
    const image = await makeTestImage(64, 64);
    const up = await injectAvatar(image, "me.png", "image/png");
    expect(up.statusCode).toBe(200);
    expect(up.json().avatarUrl).toContain(`/files/users/${userId}/avatar`);
    expect(await ctx.deps.storage.exists(`users/${userId}/avatar.png`)).toBe(true);

    const del = await app.inject({
      method: "DELETE",
      url: "/api/users/me/avatar",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().avatarUrl).toBeNull();
  });

  it("rejects a non-image avatar", async () => {
    const res = await injectAvatar(Buffer.from("nope"), "me.png", "image/png");
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/users/me/password", () => {
  it("changes the password when the current one is correct", async () => {
    // createUserWithToken seeds password "password123"
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: "password123", newPassword: "newpassword456" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("rejects an incorrect current password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: "wrong", newPassword: "newpassword456" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a too-short new password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: "password123", newPassword: "short" },
    });
    expect(res.statusCode).toBe(400);
  });
});
