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
