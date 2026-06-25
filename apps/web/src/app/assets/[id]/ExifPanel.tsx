"use client";

import type { ImageMetadataDTO } from "../../../lib/types";
import { useTranslation } from "../../../lib/i18n";

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
  const { t } = useTranslation();
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
      <h3 className="vault-section-label">{t("exif.title")}</h3>
      <ExifRow label={t("exif.captured")} value={captured || null} />
      <ExifRow
        label={t("exif.camera")}
        value={[m.cameraMake, m.cameraModel].filter(Boolean).join(" ") || null}
      />
      <ExifRow label={t("exif.lens")} value={m.lens} />
      <ExifRow label={t("exif.exposure")} value={exposure || null} />
      <ExifRow label={t("exif.software")} value={m.software} />
      <ExifRow label={t("exif.colorSpace")} value={m.colorSpace} />
      <ExifRow label={t("exif.dpi")} value={m.dpi} />
      <ExifRow label={t("exif.creator")} value={m.creator} />
      <ExifRow label={t("exif.copyright")} value={m.copyright} />
      {m.keywords && m.keywords.length > 0 && (
        <ExifRow label={t("exif.keywords")} value={m.keywords.join(", ")} />
      )}

      {gps && (
        <div style={{ marginTop: 12 }}>
          <div className="vault-kv">
            <span className="k">{t("exif.location")}</span>
            <span className="v">
              {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
              {gps.altitude !== null ? ` · ${Math.round(gps.altitude)}m` : ""}
            </span>
          </div>
          <iframe
            className="exif-map"
            title={t("exif.mapTitle")}
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
            {t("exif.viewOnMap")}
          </a>
        </div>
      )}
    </div>
  );
}
