import { describe, it, expect, vi } from "vitest";
import { ApiClient } from "../lib/api-client.js";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("ApiClient.login", () => {
  it("posts credentials and stores the returned tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ accessToken: "acc", refreshToken: "ref" }),
      );
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });

    const tokens = await client.login("a@b.com", "password123");

    expect(tokens.accessToken).toBe("acc");
    expect(client.getAccessToken()).toBe("acc");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.com",
      password: "password123",
    });
  });
});

describe("ApiClient authenticated requests", () => {
  it("attaches the bearer token to requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("my-token");

    await client.listAssets();

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe("Bearer my-token");
  });

  it("throws an error with the status on non-2xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "nope" }, 403));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");

    await expect(client.listAssets()).rejects.toThrow(/403/);
  });
});

describe("ApiClient default fetch binding", () => {
  it("calls the global fetch with the correct this-context (no Illegal invocation)", async () => {
    // Browsers' native fetch throws "Illegal invocation" if called with a
    // `this` other than the global object. Simulate that contract.
    const original = globalThis.fetch;
    const calls: string[] = [];
    function boundOnlyFetch(this: unknown, url: string) {
      if (this !== globalThis && this !== undefined) {
        throw new TypeError("Illegal invocation");
      }
      calls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
        text: async () => "{}",
      } as Response);
    }
    globalThis.fetch = boundOnlyFetch as typeof fetch;

    try {
      // No fetchFn provided -> must use the global fetch safely.
      const client = new ApiClient({ baseUrl: "" });
      client.setAccessToken("t");
      await expect(client.listAssets()).resolves.toEqual({ items: [] });
      expect(calls).toEqual(["/api/assets"]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
