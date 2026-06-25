"use client";

import type { ImageMetadataDTO } from "../../../lib/types";

function ExifRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  if (value === null || value === "") return null;
  return (
    <div className="vault-kv">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

/** Read-only EXIF / camera details, including a GPS map when present. */
export function ExifPanel({ metadata }: { metadata: ImageMetadataDTO }) {
  const m = metadata;
  const captured =
    m.capturedAt &&
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(m.capturedAt));
  const exposure = [
    m.exposureTime != null ? `${m.exposureTime}s` : null,
    m.fNumber != null ? `f/${m.fNumber}` : null,
    m.iso != null ? `ISO ${m.iso}` : null,
    m.focalLength != null ? `${m.focalLength}mm` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Only treat GPS as valid when both coordinates are finite, in-range numbers.
  const gps =
    m.gps &&
    Number.isFinite(m.gps.lat) &&
    Number.isFinite(m.gps.lng) &&
    Math.abs(m.gps.lat) <= 90 &&
    Math.abs(m.gps.lng) <= 180
      ? m.gps
      : null;
  const bbox = gps
    ? [gps.lng - 0.01, gps.lat - 0.01, gps.lng + 0.01, gps.lat + 0.01].join(",")
    : "";

  return (
    <div>
      <h3 className="vault-section-label">Camera / EXIF details</h3>
      <ExifRow label="Captured" value={captured || null} />
      <ExifRow
        label="Camera"
        value={[m.cameraMake, m.cameraModel].filter(Boolean).join(" ") || null}
      />
      <ExifRow label="Lens" value={m.lens} />
      <ExifRow label="Exposure" value={exposure || null} />
      <ExifRow label="Software" value={m.software} />
      <ExifRow label="Color space" value={m.colorSpace} />
      <ExifRow label="DPI" value={m.dpi} />
      <ExifRow label="Creator" value={m.creator} />
      <ExifRow label="Copyright" value={m.copyright} />
      {m.keywords && m.keywords.length > 0 && (
        <ExifRow label="Keywords" value={m.keywords.join(", ")} />
      )}

      {gps && (
        <div style={{ marginTop: 12 }}>
          <div className="vault-kv">
            <span className="k">Location</span>
            <span className="v">
              {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
              {gps.altitude !== null ? ` · ${Math.round(gps.altitude)}m` : ""}
            </span>
          </div>
          <iframe
            className="exif-map"
            title="Capture location"
            loading="lazy"
            style={{ width: "100%", height: 200, border: 0, borderRadius: 12, marginTop: 8 }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${gps.lat},${gps.lng}`}
          />
          <a
            href={`https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lng}#map=15/${gps.lat}/${gps.lng}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13 }}
          >
            View on map
          </a>
        </div>
      )}
    </div>
  );
}
