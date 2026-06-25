import type { ImageGpsDTO, ImageMetadataDTO } from "@assetx/shared-types";

/** Loosely-typed bag of EXIF/IPTC/XMP fields as returned by exifr. */
export type RawExif = Record<string, unknown>;

/** Bound stored metadata so a crafted file can't inflate metadataJson. */
const MAX_STRING_LENGTH = 256;
const MAX_KEYWORDS = 50;

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? value.slice(0, MAX_STRING_LENGTH)
    : value;
}

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? truncate(trimmed) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    // EXIF datetimes look like "2021:07:15 14:30:00"; normalize to ISO.
    const exifMatch =
      /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
    if (exifMatch) {
      const [, y, mo, d, h, mi, s] = exifMatch;
      const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

/** Render an exposure time (seconds) as a conventional fraction string. */
function exposure(value: unknown): string | null {
  const seconds = num(value);
  if (seconds === null || seconds <= 0) return null;
  if (seconds >= 1) return `${seconds}`;
  return `1/${Math.round(1 / seconds)}`;
}

function flash(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return (value & 0x1) === 1; // bit 0 = fired
  if (typeof value === "string") {
    if (/no flash|did not fire|off/i.test(value)) return false;
    if (/fired|on|flash/i.test(value)) return true;
  }
  return null;
}

function gps(raw: RawExif): ImageGpsDTO | null {
  // exifr returns decimal `latitude`/`longitude` when gps parsing is enabled.
  const lat = num(raw.latitude);
  const lng = num(raw.longitude);
  if (lat === null || lng === null) return null;
  // Reject out-of-range/garbage coordinates.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat,
    lng,
    altitude: num(raw.GPSAltitude ?? raw.altitude),
  };
}

const COLOR_SPACES: Record<number, string> = {
  1: "sRGB",
  2: "Adobe RGB",
  65535: "Uncalibrated",
};

function colorSpace(raw: RawExif): string | null {
  const value = raw.ColorSpace;
  if (typeof value === "number") return COLOR_SPACES[value] ?? null;
  if (typeof value === "string") {
    // exifr may not translate the enum; map numeric-string sentinels too.
    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber in COLOR_SPACES) {
      return COLOR_SPACES[asNumber]!;
    }
    return str(value);
  }
  return null;
}

function dpi(raw: RawExif): number | null {
  const x = num(raw.XResolution);
  if (x === null) return null;
  // EXIF ResolutionUnit: 2 = inches (DPI), 3 = centimeters. Only inches map to DPI.
  const unit = raw.ResolutionUnit;
  if (unit === "cm" || unit === "centimeters" || unit === 3) return null;
  return Math.round(x);
}

function keywords(raw: RawExif): string[] | null {
  const value = raw.Keywords ?? raw.subject;
  const source = Array.isArray(value) ? value : value != null ? [value] : [];
  const list = source
    .map((v) => str(v))
    .filter((v): v is string => v !== null)
    .slice(0, MAX_KEYWORDS);
  return list.length > 0 ? list : null;
}

/**
 * Normalize exifr's loosely-typed output into the shared ImageMetadataDTO.
 * Returns null when nothing useful could be extracted.
 */
export function normalizeMetadata(raw: RawExif): ImageMetadataDTO | null {
  const metadata: ImageMetadataDTO = {
    cameraMake: str(raw.Make),
    cameraModel: str(raw.Model),
    lens: str(raw.LensModel ?? raw.Lens ?? raw.LensInfo),
    software: str(raw.Software),
    capturedAt: isoDate(
      raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateTime,
    ),
    exposureTime: exposure(raw.ExposureTime),
    fNumber: num(raw.FNumber),
    iso: num(raw.ISO ?? raw.ISOSpeedRatings),
    focalLength: num(raw.FocalLength),
    flash: flash(raw.Flash),
    gps: gps(raw),
    orientation: num(raw.Orientation),
    colorSpace: colorSpace(raw),
    dpi: dpi(raw),
    keywords: keywords(raw),
    creator: str(raw.Artist ?? raw.Creator ?? raw.byline),
    copyright: str(raw.Copyright ?? raw.rights),
  };

  const hasAny = Object.values(metadata).some(
    (v) => v !== null && !(Array.isArray(v) && v.length === 0),
  );
  return hasAny ? metadata : null;
}
