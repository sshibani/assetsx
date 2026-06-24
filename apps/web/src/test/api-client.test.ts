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

describe("ApiClient.signup", () => {
  it("posts account name + credentials and stores the returned tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ accessToken: "acc", refreshToken: "ref" }),
      );
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });

    const tokens = await client.signup("Acme", "a@b.com", "password123");

    expect(tokens.accessToken).toBe("acc");
    expect(client.getAccessToken()).toBe("acc");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/signup");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      accountName: "Acme",
      email: "a@b.com",
      password: "password123",
    });
  });
});

describe("ApiClient admin & settings methods", () => {
  it("gets account settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ accountId: "a1", dateTimeFormat: "ISO" }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    const settings = await client.getAccountSettings("a1");
    expect(settings.dateTimeFormat).toBe("ISO");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/accounts/a1/settings");
  });

  it("updates account settings with PUT", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ accountId: "a1", timezone: "UTC" }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.updateAccountSettings("a1", { timezone: "UTC" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/accounts/a1/settings");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ timezone: "UTC" });
  });

  it("lists members", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.listMembers("a1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/accounts/a1/members");
  });

  it("adds a member", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "m1", role: "account_viewer" }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.addMember("a1", "u@x.test", "account_viewer");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/accounts/a1/members");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "u@x.test",
      role: "account_viewer",
    });
  });

  it("removes a member with DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.removeMember("a1", "m1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/accounts/a1/members/m1");
    expect(init.method).toBe("DELETE");
  });

  it("lists admin accounts with a query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.listAdminAccounts("needle");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/admin/accounts?q=needle");
  });

  it("lists admin accounts without a query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.listAdminAccounts();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/admin/accounts");
  });

  it("lists admin users with a query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.listAdminUsers("needle");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/admin/users?q=needle");
  });

  it("sets a user's global role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "u1", globalRole: "super_user" }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.setUserGlobalRole("u1", "super_user");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/admin/users/u1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ globalRole: "super_user" });
  });
});

describe("ApiClient bundle methods", () => {
  it("lists bundles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.listBundles();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/bundles");
  });

  it("gets a bundle", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "b1", items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.getBundle("b1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/bundles/b1");
  });

  it("creates a bundle with POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "b1", title: "New" }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.createBundle({ title: "New", description: "d" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ title: "New", description: "d" });
  });

  it("updates a bundle with PATCH", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "b1", title: "Renamed" }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.updateBundle("b1", { title: "Renamed" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles/b1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ title: "Renamed" });
  });

  it("deletes a bundle with DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.deleteBundle("b1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles/b1");
    expect(init.method).toBe("DELETE");
  });

  it("adds an asset to a bundle with POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "b1", assetCount: 1 }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.addAssetToBundle("b1", "a1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles/b1/assets");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ assetId: "a1" });
  });

  it("removes an asset from a bundle with DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.removeAssetFromBundle("b1", "a1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles/b1/assets/a1");
    expect(init.method).toBe("DELETE");
  });

  it("lists the bundles containing an asset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.listAssetBundles("a1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/assets/a1/bundles");
  });

  it("creates a share with POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ id: "s1", token: "tok", url: "http://x/shared/bundles/tok" }),
      );
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    const share = await client.createBundleShare("b1");
    expect(share.token).toBe("tok");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles/b1/share");
    expect(init.method).toBe("POST");
  });

  it("revokes a share with DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    client.setAccessToken("t");
    await client.revokeBundleShare("b1", "s1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/bundles/b1/share/s1");
    expect(init.method).toBe("DELETE");
  });

  it("gets a public shared bundle by token (no auth required)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ title: "Public", items: [] }));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchMock });
    const bundle = await client.getSharedBundle("tok");
    expect(bundle.title).toBe("Public");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/shared/bundles/tok");
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
