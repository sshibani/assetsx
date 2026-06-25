import type { Asset, Rendition } from "@prisma/client";
import type { StorageProvider } from "@assetx/storage";
import type {
  AssetDTO,
  ImageMetadataDTO,
  PublicAssetDTO,
  RenditionName,
} from "@assetx/shared-types";
import { parseJsonObject } from "../lib/json.js";

/** Storage key for an asset's original (uploaded) file. */
export function originalKey(assetId: string): string {
  return `assets/${assetId}/original`;
}

/**
 * Map a persisted asset (+ its renditions) to the public-facing AssetDTO.
 * Shared by every service that returns assets so the DTO shape and URL
 * strategy live in exactly one place.
 */
export function assetToDTO(
  asset: Asset,
  renditions: Rendition[],
  storage: StorageProvider,
): AssetDTO {
  return {
    id: asset.id,
    accountId: asset.accountId,
    ownerId: asset.ownerId,
    originalName: asset.originalName,
    status: asset.status as AssetDTO["status"],
    checksum: asset.checksum,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    sizeBytes: asset.sizeBytes,
    title: asset.title,
    description: asset.description,
    metadataSource: asset.metadataSource as AssetDTO["metadataSource"],
    metadata: parseJsonObject<ImageMetadataDTO>(asset.metadataJson),
    renditions: renditions.map((r) => ({
      id: r.id,
      name: r.name as RenditionName,
      width: r.width,
      height: r.height,
      format: r.format,
      sizeBytes: r.sizeBytes,
      url: storage.getUrl(r.storageKey),
    })),
    originalUrl: storage.getUrl(originalKey(asset.id)),
    expiresAt: asset.expiresAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

/**
 * Map an asset to the minimal, non-sensitive shape exposed to unauthenticated
 * share recipients. Deliberately omits internal identifiers (id, accountId,
 * ownerId), the checksum, status/metadata provenance, and the original
 * full-resolution download URL. Only viewable renditions are surfaced.
 */
const PUBLIC_RENDITIONS: RenditionName[] = ["thumb", "standard", "large"];

export function publicAssetToDTO(
  asset: Asset,
  renditions: Rendition[],
  storage: StorageProvider,
): PublicAssetDTO {
  return {
    title: asset.title,
    originalName: asset.originalName,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    renditions: renditions
      .filter((r) => PUBLIC_RENDITIONS.includes(r.name as RenditionName))
      .map((r) => ({
        name: r.name as RenditionName,
        width: r.width,
        height: r.height,
        url: storage.getUrl(r.storageKey),
      })),
  };
}
