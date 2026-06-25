/** Pure formatting + classification helpers for the Vault DAM UI. */

import type { VaultAssetType } from "./model";

const IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const LOGO_FORMATS = new Set(["svg"]);
const DOCUMENT_FORMATS = new Set(["pdf", "doc", "docx"]);

/**
 * Classify an asset into the Library filter types. "image" and "document" are
 * derived from format today; "logo" only matches SVG until richer
 * classification ships (ASS-51).
 */
export function classifyAssetType(format: string): VaultAssetType {
  const f = format.toLowerCase();
  if (LOGO_FORMATS.has(f)) return "logo";
  if (DOCUMENT_FORMATS.has(f)) return "document";
  if (IMAGE_FORMATS.has(f)) return "image";
  // Default unknowns to document so they remain visible under a filter.
  return "document";
}

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 100 || exponent === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[exponent]}`;
}

/** Compact relative time, e.g. "4 minutes ago", "2h ago", "3d ago". */
export function relativeTime(value: string, now: number = Date.now()): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = now - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr}y ago`;
}

/** "1920 × 1080" or null when dimensions are unknown. */
export function formatDimensions(
  width: number | null,
  height: number | null,
): string | null {
  if (width == null || height == null) return null;
  return `${width} × ${height}`;
}

/** Format a brand color at a given alpha as an rgba() string. */
export function brandAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Friendly label for a rendition by its pipeline name. The asset-detail
 * rendition rail shows these tiers (largest → smallest).
 */
const RENDITION_LABELS: Record<string, string> = {
  original: "Original",
  large: "High",
  standard: "Medium",
  thumb: "Low",
};

export function renditionLabel(name: string): string {
  return RENDITION_LABELS[name] ?? name;
}

/** Display order for the rendition rail (largest first). */
export const RENDITION_ORDER = ["original", "large", "standard", "thumb"];

/** "64.2 / 100 GB" from raw byte counts. */
export function formatStorageLabel(usedBytes: number, quotaBytes: number): string {
  const gb = (n: number) => n / 1024 ** 3;
  const used = gb(usedBytes);
  const quota = gb(quotaBytes);
  const usedStr = used >= 100 ? Math.round(used).toString() : (Math.round(used * 10) / 10).toString();
  const quotaStr = quota >= 100 ? Math.round(quota).toString() : (Math.round(quota * 10) / 10).toString();
  return `${usedStr} / ${quotaStr} GB`;
}
