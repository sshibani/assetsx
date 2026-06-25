"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/client-context";
import type { AssetDTO } from "../lib/types";
import { toVaultAsset } from "../lib/vault/data";
import type { VaultAsset, VaultAssetType } from "../lib/vault/model";
import { formatBytes, relativeTime } from "../lib/vault/format";
import { Icon } from "../components/ui/Icon";
import { AssetCard } from "../components/vault/AssetCard";
import { AddToBundleModal, DeleteModal } from "../components/vault/modals";

type Filter = "all" | VaultAssetType;
type Layout = "grid" | "list";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "document", label: "Documents" },
  { key: "logo", label: "Logos" },
];

export default function LibraryPage() {
  const { client, isAuthenticated, activeAccount, hasPermission } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<VaultAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<Layout>("grid");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | "addToBundle" | "delete">(null);

  const canDelete = hasPermission("assets:delete");

  const refresh = async () => {
    const { items } = await client.listAssets();
    setAssets(items.map((a: AssetDTO) => toVaultAsset(a)));
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      refresh().catch(() => router.push("/login"));
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeAccount?.account.id]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: assets.length, image: 0, document: 0, logo: 0 };
    for (const a of assets) c[a.type] += 1;
    return c;
  }, [assets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter !== "all" && a.type !== filter) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.tags.some((t) => t.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [assets, filter, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const deleteSelected = async () => {
    const ids = [...selected];
    await Promise.allSettled(ids.map((id) => client.deleteAsset(id)));
    clearSelection();
    await refresh();
  };

  return (
    <>
      <div className="vault-view-header">
        <div className="vault-header-row">
          <div>
            <h1 className="vault-view-title">All assets</h1>
            <div className="vault-view-sub">
              {assets.length} {assets.length === 1 ? "asset" : "assets"} · {activeAccount?.account.name}
            </div>
          </div>
          <div className="vault-search">
            <Icon name="search" size={17} />
            <input
              placeholder="Search assets, tags, people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="vault-filter-row">
        <div className="vault-filter-left">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`vault-chip${filter === f.key ? " selected" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="vault-chip-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="vault-filter-right">
          <div className="vault-segmented" role="group" aria-label="Layout">
            <button
              className={layout === "grid" ? "active" : ""}
              aria-label="Grid view"
              aria-pressed={layout === "grid"}
              onClick={() => setLayout("grid")}
            >
              <Icon name="grid" size={16} />
            </button>
            <button
              className={layout === "list" ? "active" : ""}
              aria-label="List view"
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="vault-main-scroll">
        <div className="vault-scroll-body">
          {loading ? (
            <div className="vault-empty">
              <div className="spinner" />
              <p>Loading your assets…</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="vault-empty">
              <h2>No assets found</h2>
              <p>Upload an image or document, or adjust your filters.</p>
            </div>
          ) : layout === "grid" ? (
            <div className="vault-grid">
              {visible.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  selected={selected.has(a.id)}
                  onToggleSelect={toggle}
                />
              ))}
            </div>
          ) : (
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Tags</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const isSel = selected.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={isSel ? "selected" : ""}
                      onClick={() => router.push(`/assets/${a.id}`)}
                    >
                      <td>
                        <div className="vault-row-name">
                          <button
                            type="button"
                            className={`vault-check${isSel ? " checked" : ""}`}
                            aria-label={isSel ? "Deselect" : "Select"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(a.id);
                            }}
                          >
                            {isSel && <Icon name="check" size={12} strokeWidth={3} />}
                          </button>
                          {a.thumbnailUrl ? (
                            <img className="vault-row-thumb" src={a.thumbnailUrl} alt="" />
                          ) : (
                            <span className="vault-row-thumb" />
                          )}
                          <span>{a.name}</span>
                        </div>
                      </td>
                      <td style={{ textTransform: "capitalize", color: "var(--text-muted)" }}>
                        {a.type}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{formatBytes(a.sizeBytes)}</td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {a.tags.slice(0, 2).join(", ") || "—"}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{relativeTime(a.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="vault-action-bar">
          <span className="count">{selected.size} selected</span>
          <span className="divider" />
          <button className="vault-bar-btn brand" onClick={() => setModal("addToBundle")}>
            <Icon name="layers" size={15} />
            Add to bundle
          </button>
          <button className="vault-bar-btn" onClick={() => alert("TODO: bulk download")}>
            <Icon name="download" size={15} />
            Download
          </button>
          {canDelete && (
            <button className="vault-bar-btn danger" onClick={() => setModal("delete")}>
              <Icon name="trash" size={15} />
              Delete
            </button>
          )}
          <span className="divider" />
          <button className="vault-bar-close" aria-label="Clear selection" onClick={clearSelection}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {modal === "addToBundle" && (
        <AddToBundleModal
          selectedCount={selected.size}
          assetIds={[...selected]}
          onClose={() => setModal(null)}
          onDone={clearSelection}
        />
      )}
      {modal === "delete" && (
        <DeleteModal
          count={selected.size}
          onClose={() => setModal(null)}
          onConfirm={deleteSelected}
        />
      )}
    </>
  );
}
