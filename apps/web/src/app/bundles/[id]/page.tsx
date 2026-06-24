"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context";
import type { AssetDTO, BundleDetailDTO } from "../../../lib/types";

export default function BundleDetailPage() {
  const { client, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [bundle, setBundle] = useState<BundleDetailDTO | null>(null);
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canUpdate = hasPermission("bundles:update");
  const canDelete = hasPermission("bundles:delete");
  const canShare = hasPermission("bundles:share");

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

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

  const save = async (data: { title?: string; description?: string }) => {
    if (!canUpdate) return;
    const updated = await client.updateBundle(id, data);
    setBundle((current) =>
      current ? { ...current, ...updated } : current,
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addAsset = async () => {
    if (!canUpdate || !selectedAsset) return;
    try {
      await client.addAssetToBundle(id, selectedAsset);
      setSelectedAsset("");
      setError(null);
      await load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 409
          ? "That asset is already in this bundle."
          : "Could not add the asset.",
      );
    }
  };

  const removeAsset = async (assetId: string) => {
    if (!canUpdate) return;
    if (!confirm("Remove this asset from the bundle?")) return;
    await client.removeAssetFromBundle(id, assetId);
    await load();
  };

  const createShare = async () => {
    if (!canShare) return;
    const share = await client.createBundleShare(id);
    setShareUrl(share.url);
    setShareCopied(false);
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; the URL is shown for manual copy
    }
  };

  const remove = async () => {
    if (!canDelete) return;
    if (!confirm("Delete this bundle?")) return;
    await client.deleteBundle(id);
    router.push("/bundles");
  };

  if (!bundle) {
    return (
      <div className="center-state">
        <div className="spinner" />
        <p>Loading bundle...</p>
      </div>
    );
  }

  const inBundle = new Set(bundle.items.map((item) => item.assetId));
  const available = assets.filter((a) => !inBundle.has(a.id));

  return (
    <>
      <header className="appbar">
        <Link href="/bundles" className="brand" style={{ fontSize: 16 }}>
          <span aria-hidden>{"<-"}</span> Back to bundles
        </Link>
        <div className="appbar-actions">
          {saved && (
            <span className="badge ready" style={{ alignSelf: "center" }}>
              Saved
            </span>
          )}
          <button className="btn danger" onClick={remove} disabled={!canDelete}>
            Delete
          </button>
        </div>
      </header>

      <main className="container">
        <div className="detail-grid">
          <div>
            <div className="panel">
              <h3 className="section-title">
                Assets in bundle ({bundle.assetCount})
              </h3>
              {bundle.items.length === 0 ? (
                <p className="dim" style={{ color: "var(--text-muted)" }}>
                  No assets in this bundle yet.
                </p>
              ) : (
                <div className="grid">
                  {bundle.items.map((item) => {
                    const asset = item.asset;
                    const thumb = asset.renditions.find(
                      (r) => r.name === "thumb",
                    );
                    return (
                      <div key={item.assetId} className="card">
                        <Link href={`/assets/${asset.id}`}>
                          {thumb ? (
                            <img
                              className="thumb"
                              src={thumb.url}
                              alt={asset.title ?? asset.originalName}
                            />
                          ) : (
                            <div className="thumb placeholder">
                              {asset.format.toUpperCase()}
                            </div>
                          )}
                        </Link>
                        <div className="meta">
                          <div className="title">
                            {asset.title ?? asset.originalName}
                          </div>
                          {canUpdate && (
                            <button
                              className="btn secondary"
                              onClick={() => removeAsset(item.assetId)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="panel">
              <h3 className="section-title">Details</h3>
              <div className="field">
                <label className="label">Title</label>
                <input
                  className="input"
                  placeholder="Untitled bundle"
                  defaultValue={bundle.title}
                  disabled={!canUpdate}
                  onBlur={(e) => save({ title: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">Description</label>
                <textarea
                  className="textarea"
                  placeholder="Describe this bundle..."
                  defaultValue={bundle.description ?? ""}
                  disabled={!canUpdate}
                  onBlur={(e) => save({ description: e.target.value })}
                />
              </div>
            </div>

            {canUpdate && (
              <div className="panel" style={{ marginTop: 20 }}>
                <h3 className="section-title">Add assets</h3>
                {available.length === 0 ? (
                  <p className="dim" style={{ color: "var(--text-muted)" }}>
                    All assets are already in this bundle.
                  </p>
                ) : (
                  <>
                    <select
                      className="input"
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
                    <button
                      className="btn block"
                      onClick={addAsset}
                      disabled={!selectedAsset}
                      style={{ marginTop: 8 }}
                    >
                      Add to bundle
                    </button>
                  </>
                )}
                {error && (
                  <p className="dim" style={{ color: "var(--danger)" }}>
                    {error}
                  </p>
                )}
              </div>
            )}

            {canShare && (
              <div className="panel" style={{ marginTop: 20 }}>
                <h3 className="section-title">Share</h3>
                <p className="dim" style={{ color: "var(--text-muted)" }}>
                  Generate a read-only link that anyone can open without signing
                  in.
                </p>
                <button
                  className="btn block"
                  onClick={createShare}
                  style={{ marginTop: 8 }}
                >
                  Create share link
                </button>
                {shareUrl && (
                  <div className="field" style={{ marginTop: 12 }}>
                    <label className="label">Share link</label>
                    <input
                      className="input"
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      className="btn secondary block"
                      onClick={copyShare}
                      style={{ marginTop: 8 }}
                    >
                      {shareCopied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
