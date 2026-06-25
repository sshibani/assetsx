/**
 * Vault DAM view-model types.
 *
 * These are the shapes the redesigned UI renders. Where the backend already
 * supports a concept (assets, bundles, members, tenants/accounts, settings) the
 * data-access layer maps the real DTOs into these. Where the backend does not
 * yet support a concept (tags, collections, versions, per-tenant brand color,
 * storage usage, per-asset sharing, asset "type" classification, member
 * last-active, tenant plan/status) the value is derived or filled from a
 * documented stub and tracked by a Linear ticket:
 *
 *   tags .............. ASS-45
 *   collections ....... ASS-46
 *   versions .......... ASS-47
 *   brandColor/logo ... ASS-48
 *   storage usage ..... ASS-49
 *   per-asset sharing . ASS-50
 *   type classify ..... ASS-51
 *   plan/status/active  ASS-52
 */

export type VaultAssetType = "image" | "document" | "logo";

export interface VaultAsset {
  id: string;
  /** Display name (title falls back to original filename). */
  name: string;
  originalName: string;
  type: VaultAssetType;
  format: string; // e.g. "jpg", "pdf"
  status: string; // pending | processing | ready | failed
  /** Best preview image URL, or null for non-image / still-processing. */
  thumbnailUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  /** ASS-45 — empty until tags ship. */
  tags: string[];
  /** ASS-46 — null until collections ship. */
  collection: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface VaultBundleMemberAvatar {
  id: string;
  initials: string;
  color: string;
}

export type VaultBundleVisibility = "private" | "internal" | "external";

export interface VaultBundle {
  id: string;
  name: string;
  description: string | null;
  assetCount: number;
  updatedAt: string;
  /** ASS-50/bundles — derived; bundles are private unless shared. */
  visibility: VaultBundleVisibility;
  /** Cover images for the collage (best-effort from member assets). */
  coverUrls: string[];
  /** ASS-52 — stubbed avatars until member-on-bundle ships. */
  members: VaultBundleMemberAvatar[];
}

export type VaultMemberRole = "Owner" | "Admin" | "Editor" | "Viewer";
export type VaultMemberStatus = "Active" | "Invited" | "Disabled";

export interface VaultMember {
  id: string; // membership id
  name: string;
  email: string;
  role: VaultMemberRole;
  status: VaultMemberStatus;
  /** ASS-52 — stub until last-active tracking ships. */
  lastActive: string;
  avatarColor: string;
}

export type VaultTenantPlan = "Business" | "Enterprise" | "Team" | "Trial";
export type VaultTenantStatus = "Active" | "Suspended";

export interface VaultTenant {
  id: string;
  name: string;
  domain: string;
  /** ASS-52 — derived/stub. */
  plan: VaultTenantPlan;
  memberCount: number | null;
  /** ASS-49 — stub until usage metering ships. */
  storageLabel: string;
  status: VaultTenantStatus;
  brandColor: string;
  isCurrent: boolean;
}

export interface VaultStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  /** Pre-formatted "64.2 / 100 GB". */
  label: string;
  /** 0..1 fraction used. */
  fraction: number;
}

export interface VaultCurrentUser {
  name: string;
  role: string;
  initials: string;
  avatarColor: string;
}

/** The accent palette offered in Settings → Branding (Glean tokens). */
export const BRAND_SWATCHES = [
  { name: "Glean Blue", value: "#343ced" },
  { name: "Violet", value: "#6a40b8" },
  { name: "Magenta", value: "#dd2ca5" },
  { name: "Emerald", value: "#15803d" },
  { name: "Tangerine", value: "#ef601b" },
  { name: "Slate", value: "#334155" },
] as const;

export const DEFAULT_BRAND_COLOR = "#343ced";

/** Deterministic pastel avatar background from a string (email/name). */
const AVATAR_PASTELS = [
  "#daf181",
  "#ffcfbd",
  "#a9e0ff",
  "#f1b7ff",
  "#ffdf69",
  "#e8e1cd",
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PASTELS[hash % AVATAR_PASTELS.length]!;
}

export function initials(value: string): string {
  const parts = value
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return value.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
