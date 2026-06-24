export const ASSET_STATUSES = ["pending", "processing", "ready", "failed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const RENDITION_NAMES = ["thumb", "standard", "large", "original"] as const;
export type RenditionName = (typeof RENDITION_NAMES)[number];

export const METADATA_SOURCES = ["manual", "llm"] as const;
export type MetadataSource = (typeof METADATA_SOURCES)[number];

export const USER_ROLES = ["super_user", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const GLOBAL_ROLES = USER_ROLES;
export type GlobalRole = UserRole;

export const ACCOUNT_ROLES = [
  "account_owner",
  "account_editor",
  "account_viewer",
] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "disabled"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const MEMBERSHIP_STATUSES = ["active", "disabled"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const PERMISSIONS = [
  "account:read",
  "account:update",
  "account:delete",
  "members:read",
  "members:manage",
  "members:manage_admins",
  "assets:read",
  "assets:create",
  "assets:update",
  "assets:delete",
  "assets:publish",
  "bundles:read",
  "bundles:create",
  "bundles:update",
  "bundles:delete",
  "bundles:share",
  "comments:read",
  "comments:create",
  "platform:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ACCOUNT_ROLE_PERMISSIONS: Record<AccountRole, Permission[]> = {
  account_owner: [
    "account:read",
    "account:update",
    "account:delete",
    "members:read",
    "members:manage",
    "members:manage_admins",
    "assets:read",
    "assets:create",
    "assets:update",
    "assets:delete",
    "assets:publish",
    "bundles:read",
    "bundles:create",
    "bundles:update",
    "bundles:delete",
    "bundles:share",
    "comments:read",
    "comments:create",
  ],
  account_editor: [
    "account:read",
    "assets:read",
    "assets:create",
    "assets:update",
    "assets:delete",
    "assets:publish",
    "bundles:read",
    "bundles:create",
    "bundles:update",
    "bundles:delete",
    "bundles:share",
    "comments:read",
    "comments:create",
  ],
  account_viewer: [
    "account:read",
    "assets:read",
    "bundles:read",
    "comments:read",
  ],
};

export function permissionsForAccountRole(role: AccountRole): Permission[] {
  return ACCOUNT_ROLE_PERMISSIONS[role];
}

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
  /** WebP quality from 1-100. Omit to use the image processor default. */
  quality?: number;
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
  accountId: string;
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

export interface BundleDTO {
  id: string;
  accountId: string;
  ownerId: string;
  title: string;
  description: string | null;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BundleAssetDTO {
  assetId: string;
  position: number;
  asset: AssetDTO;
}

export interface BundleDetailDTO extends BundleDTO {
  items: BundleAssetDTO[];
}

export interface BundleShareDTO {
  id: string;
  bundleId: string;
  createdById: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Returned only once, when a share is created. Includes the raw token and the
 * shareable URL; the token itself is never persisted (only its hash is stored)
 * and cannot be retrieved again.
 */
export interface BundleShareCreatedDTO extends BundleShareDTO {
  token: string;
  url: string;
}

/** Read-only, unauthenticated view of a shared bundle resolved by token. */
export interface PublicBundleDTO {
  title: string;
  description: string | null;
  items: BundleAssetDTO[];
}

export interface AssetCommentDTO {
  id: string;
  accountId: string;
  assetId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetActivityType = "asset.created" | "asset.updated";

export interface AssetActivityDTO {
  id: string;
  accountId: string;
  assetId: string;
  actorId: string | null;
  actorEmail: string | null;
  type: AssetActivityType;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export type AssetTimelineItemDTO =
  | {
      kind: "comment";
      id: string;
      createdAt: string;
      comment: AssetCommentDTO;
    }
  | {
      kind: "activity";
      id: string;
      createdAt: string;
      activity: AssetActivityDTO;
    };

export interface AccountDTO {
  id: string;
  name: string;
  slug: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccountMembershipDTO {
  id: string;
  accountId: string;
  userId: string;
  email: string;
  role: AccountRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export const DATE_TIME_FORMATS = ["ISO", "US", "EU"] as const;
export type DateTimeFormat = (typeof DATE_TIME_FORMATS)[number];

export interface AccountSettingsDTO {
  accountId: string;
  dateTimeFormat: DateTimeFormat;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthAccountContext {
  account: AccountDTO;
  membership: AccountMembershipDTO;
  permissions: Permission[];
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
  globalRole: GlobalRole;
  createdAt: string;
}

export interface SignupRequest {
  accountName: string;
  email: string;
  password: string;
}

export interface AdminUserDTO extends UserDTO {
  accountCount: number;
}

export interface AdminAccountDTO extends AccountDTO {
  memberCount: number;
}

export interface AdminUserDetailDTO extends UserDTO {
  memberships: AccountMembershipDTO[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user?: UserDTO;
  activeAccount?: AuthAccountContext | null;
  accounts?: AuthAccountContext[];
}
