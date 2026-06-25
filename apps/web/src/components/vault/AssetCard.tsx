"use client";

import { useRouter } from "next/navigation";
import type { VaultAsset } from "../../lib/vault/model";
import { formatBytes, formatDimensions, relativeTime } from "../../lib/vault/format";
import { Icon } from "../ui/Icon";

/** Pastel tint for logo/document thumbnails, stable per asset. */
function tint(seed: string): string {
  const pastels = ["#eef0ff", "#fef0f7", "#eafff3", "#fff6e9", "#eef7ff", "#f3eeff"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pastels[hash % pastels.length]!;
}

export function AssetThumb({ asset }: { asset: VaultAsset }) {
  if (asset.thumbnailUrl) {
    return <img src={asset.thumbnailUrl} alt={asset.name} loading="lazy" />;
  }
  if (asset.type === "logo") {
    return (
      <div className="vault-thumb-logo" style={{ background: tint(asset.id) }}>
        {asset.name.slice(0, 8)}
      </div>
    );
  }
  if (asset.type === "document") {
    return (
      <div className="vault-thumb-doc" style={{ background: tint(asset.id) }}>
        <div className="vault-doc-page">
          <div className="vault-doc-bar" />
          <div className="vault-doc-line" />
          <div className="vault-doc-line" style={{ width: "90%" }} />
          <div className="vault-doc-line" style={{ width: "75%" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="vault-thumb-doc" style={{ background: tint(asset.id) }}>
      <span style={{ color: "var(--text-faint)", fontSize: 13 }}>Processing…</span>
    </div>
  );
}

export function AssetCard({
  asset,
  selected,
  onToggleSelect,
  compact,
}: {
  asset: VaultAsset;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const dims = formatDimensions(asset.width, asset.height);

  return (
    <div
      className={`vault-card${selected ? " selected" : ""}`}
      onClick={() => router.push(`/assets/${asset.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/assets/${asset.id}`);
      }}
    >
      <div className="vault-thumb">
        <AssetThumb asset={asset} />
        <span className="vault-format-badge">{asset.format.toUpperCase()}</span>
        <button
          type="button"
          className={`vault-select-box${selected ? " checked" : ""}`}
          aria-label={selected ? "Deselect asset" : "Select asset"}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(asset.id);
          }}
        >
          {selected && <Icon name="check" size={13} strokeWidth={3} />}
        </button>
      </div>
      <div className="vault-card-meta">
        <div className="vault-card-name">{asset.name}</div>
        <div className="vault-card-sub">
          {compact
            ? formatBytes(asset.sizeBytes)
            : `${dims ?? formatBytes(asset.sizeBytes)} · ${relativeTime(asset.updatedAt)}`}
        </div>
        {!compact && asset.tags.length > 0 && (
          <div className="vault-tag-row">
            {asset.tags.slice(0, 3).map((t) => (
              <span key={t} className="vault-tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
