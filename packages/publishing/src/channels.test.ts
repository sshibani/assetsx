import { describe, it, expect, vi } from "vitest";
import { LocalPublicChannel } from "./local-public-channel.js";
import { WebhookChannel } from "./webhook-channel.js";
import { ChannelRegistry } from "./registry.js";
import type { PublishableAsset } from "./types.js";

const asset: PublishableAsset = {
  id: "asset-1",
  title: "Sunset",
  description: "A nice sunset",
  altText: "sunset over the sea",
  tags: ["nature", "sky"],
  width: 1920,
  height: 1080,
  format: "webp",
  renditions: {
    thumb: "http://host/public/asset-1/thumb",
    standard: "http://host/public/asset-1/standard",
    large: "http://host/public/asset-1/large",
    original: "http://host/public/asset-1/original",
  },
};

describe("LocalPublicChannel", () => {
  it("publishes successfully and returns a public url reference", async () => {
    const channel = new LocalPublicChannel({ publicBaseUrl: "http://host/public" });
    const result = await channel.publish(asset);
    expect(result.status).toBe("success");
    expect(result.channelId).toBe("local-public");
    expect(result.reference).toBe("http://host/public/asset-1");
  });
});

describe("WebhookChannel", () => {
  it("POSTs a JSON payload and succeeds on 2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const channel = new WebhookChannel({
      endpoint: "http://example.com/hook",
      fetchFn: fetchMock,
    });

    const result = await channel.publish(asset);

    expect(result.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://example.com/hook");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body.event).toBe("asset.published");
    expect(body.asset.id).toBe("asset-1");
    expect(body.asset.renditions.thumb).toBe("http://host/public/asset-1/thumb");
    expect(typeof body.publishedAt).toBe("string");
  });

  it("returns failed when the endpoint responds non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const channel = new WebhookChannel({
      endpoint: "http://example.com/hook",
      fetchFn: fetchMock,
    });
    const result = await channel.publish(asset);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("500");
  });

  it("returns failed when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const channel = new WebhookChannel({
      endpoint: "http://example.com/hook",
      fetchFn: fetchMock,
    });
    const result = await channel.publish(asset);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("network down");
  });
});

describe("ChannelRegistry", () => {
  it("registers and retrieves channels by id", () => {
    const local = new LocalPublicChannel({ publicBaseUrl: "http://host/public" });
    const registry = new ChannelRegistry([local]);
    expect(registry.get("local-public")).toBe(local);
    expect(registry.list().map((c) => c.id)).toContain("local-public");
  });

  it("throws for an unknown channel id", () => {
    const registry = new ChannelRegistry([]);
    expect(() => registry.get("nope")).toThrow();
  });
});
