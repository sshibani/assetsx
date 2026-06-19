import type { RenditionName } from "@assetx/shared-types";

export type PublishableRenditions = Partial<Record<RenditionName, string>>;

export interface PublishableAsset {
  id: string;
  title: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  format: string;
  originalUrl: string;
  renditions: PublishableRenditions;
}

export interface PublishResult {
  channelId: string;
  status: "success" | "failed";
  reference: string | null;
  error: string | null;
}

export interface ChannelInfo {
  id: string;
  label: string;
}

export interface ChannelPublisher {
  readonly id: string;
  readonly label: string;
  publish(asset: PublishableAsset): Promise<PublishResult>;
  unpublish(reference: string): Promise<void>;
}
