/**
 * Data-access layer for the Vault DAM UI. Maps real backend DTOs into the
 * view-model shapes the redesigned screens consume, and supplies documented
 * stubs for concepts the backend does not yet expose (see ./model.ts header).
 */

import type {
  AccountMembershipDTO,
  AssetDTO,
  AuthAccountContext,
  BundleDTO,
} from "../types";
import {
  avatarColor,
  initials,
  type VaultAsset,
  type VaultBundle,
  type VaultBundleVisibility,
  type VaultMember,
  type VaultMemberRole,
  type VaultMemberStatus,
  type VaultStorageUsage,
  type VaultTenant,
  type VaultTenantPlan,
} from "./model";
import {
  classifyAssetType,
  formatStorageLabel,
} from "./format";

function bestRendition(asset: AssetDTO, names: string[]): string | null {
  for (const name of names) {
    const r = asset.renditions.find((rd) => rd.name === name);
    if (r) return r.url;
  }
  return null;
}

export function toVaultAsset(asset: AssetDTO): VaultAsset {
  const type = classifyAssetType(asset.format);
  const thumbnailUrl = bestRendition(asset, ["thumb", "standard", "large"]);
  const previewUrl =
    bestRendition(asset, ["large", "standard", "thumb"]) ??
    (type === "image" ? asset.originalUrl : null);
  return {
    id: asset.id,
    name: asset.title ?? asset.originalName,
    originalName: asset.originalName,
    type,
    format: asset.format.toLowerCase(),
    status: asset.status,
    thumbnailUrl,
    previewUrl,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    tags: asset.tags ?? [],
    // ASS-46: collections not yet on AssetDTO.
    collection: null,
    uploadedBy: null,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    expiresAt: asset.expiresAt,
  };
}

function bundleVisibility(_bundle: BundleDTO): VaultBundleVisibility {
  // ASS-50: bundle share-state isn't on the list DTO; default to private.
  return "private";
}

export function toVaultBundle(
  bundle: BundleDTO,
  coverUrls: string[] = [],
): VaultBundle {
  return {
    id: bundle.id,
    name: bundle.title,
    description: bundle.description,
    assetCount: bundle.assetCount,
    updatedAt: bundle.updatedAt,
    visibility: bundleVisibility(bundle),
    coverUrls,
    // ASS-52: per-bundle members not modeled; show none for now.
    members: [],
  };
}

const ROLE_LABELS: Record<string, VaultMemberRole> = {
  account_owner: "Owner",
  account_editor: "Editor",
  account_viewer: "Viewer",
};

function memberRole(role: string): VaultMemberRole {
  return ROLE_LABELS[role] ?? "Viewer";
}

function memberStatus(status: string): VaultMemberStatus {
  if (status === "active") return "Active";
  if (status === "disabled") return "Disabled";
  return "Invited";
}

export function toVaultMember(m: AccountMembershipDTO): VaultMember {
  return {
    id: m.id,
    name: m.email.replace(/@.*/, ""),
    email: m.email,
    role: memberRole(m.role),
    status: memberStatus(m.status),
    // ASS-52: last-active tracking not available.
    lastActive: m.status === "active" ? "—" : "Invited",
    avatarColor: avatarColor(m.email),
  };
}

const TENANT_PLANS: VaultTenantPlan[] = ["Business", "Enterprise", "Team", "Trial"];

/** Deterministic stub plan until ASS-52 ships a real plan field. */
function stubPlan(seed: string): VaultTenantPlan {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TENANT_PLANS[hash % TENANT_PLANS.length]!;
}

export function toVaultTenant(
  ctx: AuthAccountContext,
  currentAccountId: string | null,
): VaultTenant {
  const account = ctx.account;
  return {
    id: account.id,
    name: account.name,
    domain: `${account.slug}.vault.app`,
    plan: stubPlan(account.id),
    memberCount: null,
    // ASS-49: storage usage not available.
    storageLabel: "—",
    status: account.status === "disabled" ? "Suspended" : "Active",
    brandColor: brandColorForAccount(account.id),
    isCurrent: account.id === currentAccountId,
  };
}

/**
 * ASS-48: per-tenant brand color isn't persisted yet. Until then, derive a
 * stable color per account from the accent palette so multi-tenant theming is
 * demonstrable. The active tenant's color drives the app accent.
 */
const ACCENTS = ["#343ced", "#6a40b8", "#dd2ca5", "#15803d", "#ef601b", "#334155"];
export function brandColorForAccount(accountId: string): string {
  let hash = 0;
  for (let i = 0; i < accountId.length; i += 1) {
    hash = (hash * 31 + accountId.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length]!;
}

/**
 * ASS-49: storage usage endpoint not available. Returns a stable placeholder so
 * the meter renders; replace with a real GET /api/accounts/:id/usage call.
 */
export function stubStorageUsage(): VaultStorageUsage {
  const quotaBytes = 100 * 1024 ** 3;
  const usedBytes = Math.round(0.642 * quotaBytes);
  return {
    usedBytes,
    quotaBytes,
    label: formatStorageLabel(usedBytes, quotaBytes),
    fraction: usedBytes / quotaBytes,
  };
}

export { initials };
