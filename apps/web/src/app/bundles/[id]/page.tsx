"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/client-context";
import type { AssetDTO, BundleDetailDTO } from "../../../lib/types";
import { toVaultAsset } from "../../../lib/vault/data";
import { relativeTime } from "../../../lib/vault/format";
import { Icon } from "../../../components/ui/Icon";
import { AssetCard } from "../../../components/vault/AssetCard";
import { DeleteModal, ShareModal } from "../../../components/vault/modals";

export default function BundleDetailPage() {
  const { client, activeAccount, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [bundle, setBundle] = useState<BundleDetailDTO | null>(null);
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "share" | "delete">(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const canUpdate = hasPermission("bundles:update");
  const canDelete = hasPermission("bundles:delete");
  const canShare = hasPermission("bundles:share");

  const load = async () => {
    const [b, allAssets] = await Promise.all([
      client.getBundle(id),
      client.listAssets(),
    ]);
    setBundle(b);
    setAssets(allAssets.items);
    setError(null);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      load().catch(() => router.push("/login"));
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addAsset = async () => {
    if (!canUpdate || !selectedAsset) return;
    try {
      await client.addAssetToBundle(id, selectedAsset);
      setSelectedAsset("");
      setAdding(false);
      await load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 409 ? "That asset is already in this bundle." : "Could not add the asset.");
    }
  };

  const openShare = async () => {
    setModal("share");
    if (canShare && !shareUrl) {
      try {
        const share = await client.createBundleShare(id);
        setShareUrl(share.url);
      } catch {
        /* ignore */
      }
    }
  };

  if (!bundle) {
    return (
      <div className="vault-empty">
        <div className="spinner" />
        <p>Loading bundle…</p>
      </div>
    );
  }

  const inBundle = new Set(bundle.items.map((i) => i.assetId));
  const available = assets.filter((a) => !inBundle.has(a.id));
  const extra = Math.max(bundle.assetCount - 3, 0);

  return (
    <>
      <div className="vault-view-header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="vault-breadcrumb">Bundles / {bundle.title}</div>
        <div className="vault-header-row">
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ width: 128, height: 96, borderRadius: 12, overflow: "hidden", flex: "none" }}>
              <div className="vault-collage" style={{ height: "100%" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="vault-collage-tile">
                    {bundle.coverUrls?.[i] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bundle.coverUrls[i]} alt="" loading="lazy" />
                    )}
                    {i === 2 && extra > 0 && (
                      <div className="vault-collage-more">+{extra}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h1 className="vault-view-title">{bundle.title}</h1>
              {bundle.description && (
                <div className="vault-view-sub" style={{ maxWidth: 540 }}>
                  {bundle.description}
                </div>
              )}
              <div className="vault-card-sub" style={{ marginTop: 6 }}>
                {bundle.assetCount} assets · updated {relativeTime(bundle.updatedAt)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canShare && (
              <button className="vault-btn brand" onClick={openShare}>
                <Icon name="share" size={16} />
                Share
              </button>
            )}
            <button className="vault-btn" onClick={() => alert("TODO: download all")}>
              <Icon name="download" size={16} />
              Download all
            </button>
            {canDelete && (
              <button className="vault-icon-btn" aria-label="Delete bundle" onClick={() => setModal("delete")}>
                <Icon name="trash" size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="vault-main-scroll">
        <div className="vault-scroll-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <strong style={{ fontSize: 15 }}>Assets in this bundle</strong>
            {canUpdate && available.length > 0 && (
              <button className="vault-btn" onClick={() => setAdding((v) => !v)}>
                <Icon name="plus" size={16} />
                Add assets
              </button>
            )}
          </div>

          {adding && (
            <div className="vault-panel" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              <select
                className="vault-input"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                <option value="">Select an asset…</option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title ?? a.originalName}
                  </option>
                ))}
              </select>
              <button className="vault-btn brand" onClick={addAsset} disabled={!selectedAsset}>
                Add
              </button>
            </div>
          )}
          {error && <p style={{ color: "var(--danger-fg)" }}>{error}</p>}

          {bundle.items.length === 0 ? (
            <div className="vault-empty">
              <p>No assets in this bundle yet.</p>
            </div>
          ) : (
            <div className="vault-grid compact">
              {bundle.items.map((item) => (
                <AssetCard
                  key={item.assetId}
                  asset={toVaultAsset(item.asset)}
                  selected={false}
                  onToggleSelect={() => {
                    if (canUpdate) void client.removeAssetFromBundle(id, item.assetId).then(load);
                  }}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal === "share" && (
        <ShareModal
          title="Share bundle"
          tenantName={activeAccount?.account.name ?? "this workspace"}
          shareLink={shareUrl}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "delete" && (
        <DeleteModal
          count={1}
          noun="bundle"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await client.deleteBundle(id);
            router.push("/bundles");
          }}
        />
      )}
    </>
  );
}
