"use client";

import type { RenditionDTO } from "../../lib/types";
import {
  formatBytes,
  RENDITION_ORDER,
  renditionLabel,
} from "../../lib/vault/format";

/** Order renditions largest → smallest by the known pipeline order. */
export function orderRenditions(renditions: RenditionDTO[]): RenditionDTO[] {
  return [...renditions].sort(
    (a, b) => RENDITION_ORDER.indexOf(a.name) - RENDITION_ORDER.indexOf(b.name),
  );
}

export function RenditionRail({
  renditions,
  activeId,
  thumbUrl,
  onSelect,
}: {
  renditions: RenditionDTO[];
  activeId: string;
  /** A small image to show inside each tier button. */
  thumbUrl: string | null;
  onSelect: (rendition: RenditionDTO) => void;
}) {
  const ordered = orderRenditions(renditions);
  if (ordered.length === 0) return null;

  const active = ordered.find((r) => r.id === activeId) ?? ordered[0]!;

  return (
    <div className="vault-rendition-rail">
      <div className="vault-rendition-caption">
        <span className="vault-rendition-label">Renditions</span>
        <span className="vault-rendition-showing">
          Showing <b>{renditionLabel(active.name)}</b> · {active.width} ×{" "}
          {active.height} · {formatBytes(active.sizeBytes)}
        </span>
      </div>
      <div className="vault-rendition-thumbs">
        {ordered.map((r) => {
          const isActive = r.id === active.id;
          return (
            <button
              key={r.id}
              type="button"
              className={`vault-rendition-btn${isActive ? " active" : ""}`}
              onClick={() => onSelect(r)}
            >
              <img
                className="vault-rendition-thumb"
                src={thumbUrl ?? r.url}
                alt=""
                loading="lazy"
              />
              <span className="vault-rendition-name">{renditionLabel(r.name)}</span>
              <span className="vault-rendition-dims">
                {r.width} × {r.height}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
