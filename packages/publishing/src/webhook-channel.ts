import type {
  ChannelPublisher,
  PublishableAsset,
  PublishResult,
} from "./types.js";

export type FetchFn = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

export interface WebhookChannelOptions {
  endpoint: string;
  fetchFn?: FetchFn;
}

export class WebhookChannel implements ChannelPublisher {
  readonly id = "webhook";
  readonly label = "Webhook";
  private readonly endpoint: string;
  private readonly fetchFn: FetchFn;

  constructor(options: WebhookChannelOptions) {
    this.endpoint = options.endpoint;
    this.fetchFn = options.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  }

  async publish(asset: PublishableAsset): Promise<PublishResult> {
    const payload = {
      event: "asset.published",
      asset: {
        id: asset.id,
        title: asset.title,
        description: asset.description,
        altText: asset.altText,
        tags: asset.tags,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        renditions: asset.renditions,
      },
      publishedAt: new Date().toISOString(),
    };

    try {
      const res = await this.fetchFn(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return {
          channelId: this.id,
          status: "failed",
          reference: null,
          error: `Webhook responded with status ${res.status}`,
        };
      }

      return {
        channelId: this.id,
        status: "success",
        reference: this.endpoint,
        error: null,
      };
    } catch (err) {
      return {
        channelId: this.id,
        status: "failed",
        reference: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async unpublish(): Promise<void> {
    // Webhook deliveries are fire-and-forget; nothing to revoke.
  }
}
