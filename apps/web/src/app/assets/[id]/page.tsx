"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context";
import type {
  AssetDTO,
  AssetTimelineItemDTO,
  BundleDTO,
  RenditionDTO,
} from "../../../lib/types";
import { toVaultAsset } from "../../../lib/vault/data";
import { formatBytes, formatDimensions, relativeTime } from "../../../lib/vault/format";
import { Icon } from "../../../components/ui/Icon";
import { AssetThumb } from "../../../components/vault/AssetCard";
import { AddToBundleModal, DeleteModal, ShareModal } from "../../../components/vault/modals";
import { TagEditor } from "../../../components/vault/TagEditor";
import { RenditionRail, orderRenditions } from "../../../components/vault/RenditionRail";
import { ActivityTab } from "../../../components/vault/ActivityTab";
import { ExifPanel } from "./ExifPanel";

type Tab = "details" | "activity";

export default function AssetDetailPage() {
  const { client, activeAccount, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [asset, setAsset] = useState<AssetDTO | null>(null);
  const [attachedBundles, setAttachedBundles] = useState<BundleDTO[]>([]);
  const [timeline, setTimeline] = useState<AssetTimelineItemDTO[]>([]);
  const [tab, setTab] = useState<Tab>("details");
  const [activeRenditionId, setActiveRenditionId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [modal, setModal] = useState<null | "share" | "addToBundle" | "delete">(null);
  const [saved, setSaved] = useState(false);

  const canUpdate = hasPermission("assets:update");
  const canDelete = hasPermission("assets:delete");
  const canManageBundles = hasPermission("bundles:update");
  const canComment = hasPermission("comments:create");

  const load = async () => {
    const a = await client.getAsset(id);
    setAsset(a);
    // Reset the active rendition to Original whenever the asset changes.
    const ordered = orderRenditions(a.renditions);
    setActiveRenditionId(ordered[0]?.id ?? null);
    client
      .listAssetTimeline(id)
      .then((r) => setTimeline(r.items))
      .catch(() => setTimeline([]));
    if (canManageBundles) {
      client
        .listAssetBundles(id)
        .then((r) => setAttachedBundles(r.items))
        .catch(() => setAttachedBundles([]));
    }
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

  const save = async (data: Partial<AssetDTO>) => {
    if (!canUpdate) return;
    const updated = await client.updateAsset(id, data);
    setAsset(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addComment = async (body: string) => {
    setPosting(true);
    try {
      const item = await client.createAssetComment(id, body);
      setTimeline((prev) => [item, ...prev]);
    } finally {
      setPosting(false);
    }
  };

  const commentCount = useMemo(
    () => timeline.filter((t) => t.kind === "comment").length,
    [timeline],
  );

  if (!asset) {
    return (
      <div className="vault-empty">
        <div className="spinner" />
        <p>Loading asset…</p>
      </div>
    );
  }

  const v = toVaultAsset(asset);
  const dims = formatDimensions(asset.width, asset.height);
  const renditions = asset.renditions;
  const activeRendition: RenditionDTO | null =
    renditions.find((r) => r.id === activeRenditionId) ??
    orderRenditions(renditions)[0] ??
    null;
  const previewUrl = activeRendition?.url ?? v.previewUrl;
  const thumbUrl = v.thumbnailUrl;

  return (
    <>
      <div className="vault-topbar">
        <button className="vault-icon-btn" aria-label="Back" onClick={() => router.push("/")}>
          <Icon name="arrow-left" size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="vault-breadcrumb" style={{ margin: 0 }}>
            <Link href="/">All assets</Link>
          </div>
          <div className="vault-topbar-title">{v.name}</div>
        </div>
        <div className="vault-topbar-actions">
          {saved && <span className="vault-badge active">Saved</span>}
          <button className="vault-btn" onClick={() => setModal("share")}>
            <Icon name="share" size={16} />
            Share
          </button>
          {canManageBundles && (
            <button className="vault-btn" onClick={() => setModal("addToBundle")}>
              <Icon name="layers" size={16} />
              Add to bundle
            </button>
          )}
          <a className="vault-btn brand" href={asset.originalUrl} target="_blank" rel="noreferrer">
            <Icon name="download" size={16} />
            Download
          </a>
          {canDelete && (
            <button className="vault-icon-btn" aria-label="More" onClick={() => setModal("delete")}>
              <Icon name="more" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="vault-detail">
        {/* Preview + rendition rail */}
        <div className="vault-preview-pane" style={{ flexDirection: "column" }}>
          <div className="vault-preview-image">
            {previewUrl ? (
              <img src={previewUrl} alt={v.name} />
            ) : (
              <div style={{ width: "60%", aspectRatio: "4/3" }}>
                <AssetThumb asset={v} />
              </div>
            )}
          </div>
          {v.type === "image" && renditions.length > 0 && (
            <RenditionRail
              renditions={renditions}
              activeId={activeRendition?.id ?? ""}
              thumbUrl={thumbUrl}
              onSelect={(r) => setActiveRenditionId(r.id)}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="vault-meta-panel" style={{ padding: 0 }}>
          <div className="vault-panel-header">
            <span className="vault-badge neutral">
              {asset.format.toUpperCase()} · {v.type}
            </span>
            <h2 className="vault-display vault-panel-title">{v.name}</h2>
            <div className="vault-tabs" style={{ padding: 0, marginTop: 20 }}>
              <button
                className={`vault-tab${tab === "details" ? " active" : ""}`}
                onClick={() => setTab("details")}
              >
                Details
              </button>
              <button
                className={`vault-tab${tab === "activity" ? " active" : ""}`}
                onClick={() => setTab("activity")}
              >
                Activity
                {commentCount > 0 && (
                  <span className="vault-tab-count">{commentCount}</span>
                )}
              </button>
            </div>
          </div>

          {tab === "details" ? (
            <div className="vault-panel-scroll">
              {canUpdate && (
                <>
                  <div className="vault-field">
                    <label className="vault-field-label">Title</label>
                    <input
                      className="vault-input"
                      defaultValue={asset.title ?? ""}
                      placeholder="Untitled"
                      onBlur={(e) => save({ title: e.target.value })}
                    />
                  </div>
                  <div className="vault-field">
                    <label className="vault-field-label">Description</label>
                    <textarea
                      className="vault-input"
                      defaultValue={asset.description ?? ""}
                      placeholder="Describe this asset…"
                      onBlur={(e) => save({ description: e.target.value })}
                    />
                  </div>
                  <div className="vault-field">
                    <label className="vault-field-label">Expiry date</label>
                    <input
                      className="vault-input"
                      type="date"
                      defaultValue={asset.expiresAt?.slice(0, 10) ?? ""}
                      onBlur={(e) =>
                        save({ expiresAt: e.target.value === "" ? null : e.target.value })
                      }
                    />
                    {asset.expiresAt && (
                      <p
                        style={{
                          fontSize: 12,
                          marginTop: 4,
                          color:
                            new Date(asset.expiresAt).getTime() < Date.now()
                              ? "var(--danger-fg)"
                              : "var(--text-muted)",
                        }}
                      >
                        {new Date(asset.expiresAt).getTime() < Date.now()
                          ? "Expired"
                          : "Expires"}{" "}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                          new Date(asset.expiresAt),
                        )}
                      </p>
                    )}
                  </div>
                  <div className="vault-divider" />
                </>
              )}

              <h3 className="vault-section-label">Details</h3>
              <div className="vault-kv">
                <span className="k">Kind</span>
                <span className="v" style={{ textTransform: "capitalize" }}>{v.type}</span>
              </div>
              {dims && (
                <div className="vault-kv">
                  <span className="k">Dimensions</span>
                  <span className="v">{dims}</span>
                </div>
              )}
              <div className="vault-kv">
                <span className="k">Size</span>
                <span className="v">{formatBytes(asset.sizeBytes)}</span>
              </div>
              <div className="vault-kv">
                <span className="k">Format</span>
                <span className="v">{asset.format.toUpperCase()}</span>
              </div>
              {asset.ownerEmail && (
                <div className="vault-kv">
                  <span className="k">Uploaded by</span>
                  <span className="v">{asset.ownerEmail}</span>
                </div>
              )}
              <div className="vault-kv">
                <span className="k">Modified</span>
                <span className="v">{relativeTime(asset.updatedAt)}</span>
              </div>

              <div className="vault-divider" />

              <h3 className="vault-section-label">Tags</h3>
              <TagEditor
                tags={asset.tags}
                disabled={!canUpdate}
                onChange={(next) => void save({ tags: next })}
              />

              {asset.metadata && (
                <>
                  <div className="vault-divider" />
                  <ExifPanel metadata={asset.metadata} />
                </>
              )}

              {canManageBundles && attachedBundles.length > 0 && (
                <>
                  <div className="vault-divider" />
                  <h3 className="vault-section-label">Used in bundles</h3>
                  {attachedBundles.map((b) => (
                    <Link
                      key={b.id}
                      href={`/bundles/${b.id}`}
                      className="vault-list-row"
                      style={{ color: "inherit" }}
                    >
                      <span
                        className="vault-avatar"
                        style={{ width: 34, height: 34, borderRadius: 8, background: "var(--surface-2)" }}
                      >
                        <Icon name="layers" size={16} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{b.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {b.assetCount} assets
                        </div>
                      </span>
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  ))}
                </>
              )}
            </div>
          ) : (
            <ActivityTab
              items={timeline}
              canComment={canComment}
              posting={posting}
              onComment={addComment}
            />
          )}
        </div>
      </div>

      {modal === "share" && (
        <ShareModal
          title="Share asset"
          tenantName={activeAccount?.account.name ?? "this workspace"}
          shareLink={null}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "addToBundle" && (
        <AddToBundleModal
          selectedCount={1}
          assetIds={[id]}
          onClose={() => setModal(null)}
          onDone={load}
        />
      )}
      {modal === "delete" && (
        <DeleteModal
          count={1}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await client.deleteAsset(id);
            router.push("/");
          }}
        />
      )}
    </>
  );
}
