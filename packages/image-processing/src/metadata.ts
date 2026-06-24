import type { ImageGpsDTO, ImageMetadataDTO } from "@assetx/shared-types";

/** Loosely-typed bag of EXIF/IPTC/XMP fields as returned by exifr. */
export type RawExif = Record<string, unknown>;

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") return String(value);
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
  return {
    lat,
    lng,
    altitude: num(raw.GPSAltitude ?? raw.altitude),
  };
}

function dpi(raw: RawExif): number | null {
  // Prefer X resolution when the unit is inches.
  const x = num(raw.XResolution);
  const unit = raw.ResolutionUnit;
  if (x !== null && (unit === "inches" || unit === 2 || unit === undefined)) {
    return Math.round(x);
  }
  return x !== null ? Math.round(x) : null;
}

function keywords(raw: RawExif): string[] | null {
  const value = raw.Keywords ?? raw.subject ?? raw.subjects;
  if (Array.isArray(value)) {
    const list = value.map((v) => str(v)).filter((v): v is string => v !== null);
    return list.length > 0 ? list : null;
  }
  const single = str(value);
  return single ? [single] : null;
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
    colorSpace: str(raw.ColorSpace),
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
