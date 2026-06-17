import type { RenditionName } from "@assetx/shared-types";

export interface PublishableAsset {
  id: string;
  title: string | null;
  description: string | null;
  altText: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  format: string;
  renditions: Record<RenditionName, string>;
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
