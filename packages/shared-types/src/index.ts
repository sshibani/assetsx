export const ASSET_STATUSES = ["pending", "processing", "ready", "failed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const RENDITION_NAMES = ["thumb", "standard", "large", "original"] as const;
export type RenditionName = (typeof RENDITION_NAMES)[number];

export const METADATA_SOURCES = ["manual", "llm"] as const;
export type MetadataSource = (typeof METADATA_SOURCES)[number];

export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PUBLICATION_STATUSES = ["success", "failed"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export interface RenditionSpec {
  name: RenditionName;
  /** Longest-edge max dimension in pixels. Omit for the untouched original. */
  maxDimension?: number;
  format: "webp" | "original";
  fit: "cover" | "inside";
}

export interface RenditionDTO {
  id: string;
  name: RenditionName;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  url: string;
}

export interface AssetDTO {
  id: string;
  ownerId: string;
  originalName: string;
  status: AssetStatus;
  checksum: string;
  width: number | null;
  height: number | null;
  format: string;
  sizeBytes: number;
  title: string | null;
  description: string | null;
  metadataSource: MetadataSource;
  renditions: RenditionDTO[];
  originalUrl: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationDTO {
  id: string;
  assetId: string;
  channelId: string;
  status: PublicationStatus;
  reference: string | null;
  error: string | null;
  createdAt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
