import type { RenditionName } from "@assetx/shared-types";
import type { PublishableAsset, PublishableRenditions } from "@assetx/publishing";
import type { WorkerDependencies } from "./dependencies.js";

/**
 * Publish an asset to a single channel and record the resulting Publication.
 * Throws on a failed delivery so the queue can retry; a failed Publication row
 * is still recorded for history.
 */
export async function publishAsset(
  deps: WorkerDependencies,
  assetId: string,
  channelId: string,
): Promise<void> {
  const asset = await deps.prisma.asset.findUnique({
    where: { id: assetId },
    include: { renditions: true },
  });
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const channel = deps.channels.get(channelId); // throws on unknown channel

  const renditions = Object.fromEntries(
    asset.renditions.map((r) => [
      r.name as RenditionName,
      deps.storage.getUrl(r.storageKey),
    ]),
  ) as PublishableRenditions;

  const publishable: PublishableAsset = {
    id: asset.id,
    title: asset.title,
    description: asset.description,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    originalUrl: deps.storage.getUrl(`assets/${asset.id}/original`),
    renditions,
  };

  const result = await channel.publish(publishable);

  await deps.prisma.publication.create({
    data: {
      assetId,
      channelId: result.channelId,
      status: result.status,
      reference: result.reference,
      error: result.error,
    },
  });

  if (result.status === "failed") {
    throw new Error(`Publish to ${channelId} failed: ${result.error ?? "unknown"}`);
  }
}
