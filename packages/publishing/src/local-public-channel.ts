import type {
  ChannelPublisher,
  PublishableAsset,
  PublishResult,
} from "./types.js";

export interface LocalPublicChannelOptions {
  publicBaseUrl: string;
}

export class LocalPublicChannel implements ChannelPublisher {
  readonly id = "local-public";
  readonly label = "Local Public URL";
  private readonly publicBaseUrl: string;

  constructor(options: LocalPublicChannelOptions) {
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
  }

  async publish(asset: PublishableAsset): Promise<PublishResult> {
    return {
      channelId: this.id,
      status: "success",
      reference: `${this.publicBaseUrl}/${asset.id}`,
      error: null,
    };
  }

  async unpublish(): Promise<void> {
    // Local public URLs are stateless; nothing to revoke server-side.
  }
}
