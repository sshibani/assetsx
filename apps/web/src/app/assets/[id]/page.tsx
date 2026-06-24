"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppFooter } from "../../AppFooter";
import { useAuth } from "../../../lib/client-context";
import type {
  AssetDTO,
  AssetTimelineItemDTO,
  BundleDTO,
  ChannelInfoLike,
  PublicationDTO,
} from "../../../lib/types";

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTimelineDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatExpiryDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function expiryInputValue(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

function expiryLabel(value: string): string {
  const prefix = new Date(value).getTime() < Date.now() ? "Expired" : "Expires";
  return `${prefix} ${formatExpiryDate(value)}`;
}

function isPdf(asset: AssetDTO): boolean {
  return asset.format.toLowerCase() === "pdf";
}

export default function AssetDetailPage() {
  const { client, permissions, user } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [asset, setAsset] = useState<AssetDTO | null>(null);
  const [channels, setChannels] = useState<ChannelInfoLike[]>([]);
  const [publications, setPublications] = useState<PublicationDTO[]>([]);
  const [timeline, setTimeline] = useState<AssetTimelineItemDTO[]>([]);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [allBundles, setAllBundles] = useState<BundleDTO[]>([]);
  const [attachedBundles, setAttachedBundles] = useState<BundleDTO[]>([]);
  const [bundlePickerOpen, setBundlePickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<Set<string>>(
    new Set(),
  );
  const [bundleSaving, setBundleSaving] = useState(false);
  const [bundleMessage, setBundleMessage] = useState<string | null>(null);
  const hasPermission = (permission: (typeof permissions)[number]) =>
    user?.globalRole === "super_user" || permissions.includes(permission);
  const canUpdate = hasPermission("assets:update");
  const canDelete = hasPermission("assets:delete");
  const canPublish = hasPermission("assets:publish");
  const canComment = hasPermission("comments:create");
  const canManageBundles = hasPermission("bundles:update");

  const load = async () => {
    const [a, ch, pubs, timelineResult] = await Promise.all([
      client.getAsset(id),
      client.listChannels(),
      client.listPublications(id),
      client.listAssetTimeline(id),
    ]);
    setAsset(a);
    setChannels(ch.items);
    setPublications(pubs.items);
    setTimeline(timelineResult.items);
    setTimelineError(null);
  };

  // Bundles are a secondary concern on this page: load them separately so a
  // failure (or lack of permission) never breaks asset loading or triggers the
  // login redirect in the main load() catch.
  const loadBundles = async () => {
    if (!canManageBundles) {
      setAllBundles([]);
      setAttachedBundles([]);
      return;
    }
    try {
      const [all, attached] = await Promise.all([
        client.listBundles(),
        client.listAssetBundles(id),
      ]);
      setAllBundles(all.items);
      setAttachedBundles(attached.items);
    } catch {
      setAllBundles([]);
      setAttachedBundles([]);
    }
  };

  const loadTimeline = async () => {
    try {
      const result = await client.listAssetTimeline(id);
      setTimeline(result.items);
      setTimelineError(null);
    } catch {
      setTimelineError("Could not load comments and activity.");
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

  // Load bundles once permissions are hydrated; never fatal to the page.
  useEffect(() => {
    if (!asset) return;
    void loadBundles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, canManageBundles]);

  const save = async (data: Partial<AssetDTO>) => {
    if (!canUpdate) return;
    const updated = await client.updateAsset(id, data);
    setAsset(updated);
    await loadTimeline();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canComment || commentSaving) return;
    const body = commentBody.trim();
    if (!body) return;
    setCommentSaving(true);
    try {
      const item = await client.createAssetComment(id, body);
      setTimeline((items) => [item, ...items]);
      setCommentBody("");
      setTimelineError(null);
    } catch {
      setTimelineError("Could not add comment.");
    } finally {
      setCommentSaving(false);
    }
  };

  const publish = async () => {
    if (selected.length === 0 || !canPublish) return;
    await client.publish(id, selected);
    setTimeout(load, 600);
  };

  const openBundlePicker = () => {
    if (!canManageBundles) return;
    setPickerSelection(new Set());
    setBundleMessage(null);
    setBundlePickerOpen(true);
  };

  const togglePick = (bundleId: string) => {
    setPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  };

  const confirmAddToBundles = async () => {
    if (!canManageBundles || pickerSelection.size === 0) return;
    setBundleSaving(true);
    const ids = [...pickerSelection];
    const results = await Promise.allSettled(
      ids.map((bundleId) => client.addAssetToBundle(bundleId, id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    await loadBundles();
    setBundleSaving(false);
    setBundlePickerOpen(false);
    setBundleMessage(
      failed === 0
        ? `Added to ${ids.length} bundle${ids.length === 1 ? "" : "s"}.`
        : `Added to ${ids.length - failed} of ${ids.length}; ${failed} failed.`,
    );
    setTimeout(() => setBundleMessage(null), 2500);
  };

  const removeFromBundle = async (bundleId: string) => {
    if (!canManageBundles) return;
    setAttachedBundles((prev) => prev.filter((b) => b.id !== bundleId));
    try {
      await client.removeAssetFromBundle(bundleId, id);
    } catch {
      // reload to restore accurate state on failure
      await loadBundles();
    }
  };

  const remove = async () => {
    if (!canDelete) return;
    if (!confirm("Delete this asset and all its renditions?")) return;
    await client.deleteAsset(id);
    router.push("/");
  };

  if (!asset) {
    return (
      <>
        <div className="center-state">
          <div className="spinner" />
          <p>Loading asset...</p>
        </div>
        <AppFooter />
      </>
    );
  }

  const attachedIds = new Set(attachedBundles.map((b) => b.id));
  const availableBundles = allBundles.filter((b) => !attachedIds.has(b.id));

  const standard =
    asset.renditions.find((r) => r.name === "standard") ??
    asset.renditions.find((r) => r.name === "original");
  const pdf = isPdf(asset);

  return (
    <>
      <header className="appbar">
        <Link href="/" className="brand" style={{ fontSize: 16 }}>
          <span aria-hidden>{"<-"}</span> Back to gallery
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
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              {standard ? (
                <img
                  className="preview"
                  src={standard.url}
                  alt={asset.title ?? asset.originalName}
                  style={{ border: "none", borderRadius: 0 }}
                />
              ) : pdf ? (
                <div className="pdf-preview">
                  <div className="pdf-icon">PDF</div>
                  <div>
                    <strong>{asset.title ?? asset.originalName}</strong>
                    <a href={asset.originalUrl} target="_blank" rel="noreferrer">
                      Open original PDF
                    </a>
                  </div>
                </div>
              ) : null}
              <div style={{ padding: "18px 20px" }}>
                <div className="kv">
                  <span className={`badge ${asset.status}`}>{asset.status}</span>
                  <span>
                    {asset.width ?? "?"}x{asset.height ?? "?"}
                  </span>
                  <span>{asset.format.toUpperCase()}</span>
                  <span>{Math.round(asset.sizeBytes / 1024)} KB</span>
                  <time dateTime={asset.createdAt}>
                    Created {formatCreatedAt(asset.createdAt)}
                  </time>
                  {asset.expiresAt && (
                    <time dateTime={asset.expiresAt}>
                      {expiryLabel(asset.expiresAt)}
                    </time>
                  )}
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 20 }}>
              <h3 className="section-title">Renditions</h3>
              <ul className="rendition-list">
                {asset.renditions.map((r) => (
                  <li key={r.id}>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                    <span className="dim">
                      {r.width}x{r.height} / {r.format}
                    </span>
                  </li>
                ))}
                {pdf && asset.renditions.length === 0 && (
                  <li>
                    <a href={asset.originalUrl} target="_blank" rel="noreferrer">
                      original
                    </a>
                    <span className="dim">PDF</span>
                  </li>
                )}
                {!pdf && asset.renditions.length === 0 && (
                  <li className="dim">Renditions are still being generated...</li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <div className="panel">
              <h3 className="section-title">Metadata</h3>
              <div className="field">
                <label className="label">Asset GUID</label>
                <div className="readonly-value" aria-readonly="true">
                  {asset.id}
                </div>
              </div>
              <div className="field">
                <label className="label">Original filename</label>
                <div className="readonly-value" aria-readonly="true">
                  {asset.originalName}
                </div>
              </div>
              <div className="field">
                <label className="label">Title</label>
                <input
                  className="input"
                  placeholder="Untitled"
                  defaultValue={asset.title ?? ""}
                  disabled={!canUpdate}
                  onBlur={(e) => save({ title: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Description</label>
                <textarea
                  className="textarea"
                  placeholder="Describe this asset..."
                  defaultValue={asset.description ?? ""}
                  disabled={!canUpdate}
                  onBlur={(e) => save({ description: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
                <label className="label">Expiry date</label>
                <input
                  className="input"
                  type="date"
                  defaultValue={expiryInputValue(asset.expiresAt)}
                  disabled={!canUpdate}
                  onBlur={(e) =>
                    save({ expiresAt: e.target.value === "" ? null : e.target.value })
                  }
                />
              </div>
            </div>

            <div className="panel" style={{ marginTop: 20 }}>
              <h3 className="section-title">Publish</h3>
              {channels.map((c) => (
                <label key={c.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    disabled={!canPublish}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked
                          ? [...s, c.id]
                          : s.filter((x) => x !== c.id),
                      )
                    }
                  />
                  {c.label}
                </label>
              ))}
              <button
                className="btn block"
                onClick={publish}
                disabled={selected.length === 0 || !canPublish}
                style={{ marginTop: 8 }}
              >
                Publish to {selected.length || "0"} channel
                {selected.length === 1 ? "" : "s"}
              </button>

              <h3 className="section-title" style={{ marginTop: 24 }}>
                Publish history
              </h3>
              {publications.length === 0 ? (
                <p className="dim" style={{ color: "var(--text-muted)" }}>
                  Not published yet.
                </p>
              ) : (
                <ul className="pub-list">
                  {publications.map((p) => (
                    <li key={p.id}>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span
                          className={`badge ${
                            p.status === "success" ? "ready" : "failed"
                          }`}
                        >
                          {p.status}
                        </span>
                        {p.channelId}
                      </span>
                      {p.reference && (
                        <a href={p.reference} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canManageBundles && (
              <div className="panel" style={{ marginTop: 20 }}>
                <h3 className="section-title">Bundles</h3>
                {attachedBundles.length === 0 ? (
                  <p className="dim" style={{ color: "var(--text-muted)" }}>
                    Not in any bundle yet.
                  </p>
                ) : (
                  <div className="chip-list">
                    {attachedBundles.map((b) => (
                      <span key={b.id} className="chip">
                        <Link href={`/bundles/${b.id}`} className="chip-label">
                          {b.title}
                        </Link>
                        <button
                          type="button"
                          className="chip-remove"
                          aria-label={`Remove from ${b.title}`}
                          title={`Remove from ${b.title}`}
                          onClick={() => removeFromBundle(b.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  className="btn block"
                  onClick={openBundlePicker}
                  style={{ marginTop: 12 }}
                >
                  + Add to bundle
                </button>
                {bundleMessage && (
                  <p className="dim" style={{ marginTop: 8 }}>
                    {bundleMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 28 }}>
          <h3 className="section-title">Comments & activity</h3>
          {canComment && (
            <form onSubmit={addComment} style={{ marginBottom: 18 }}>
              <textarea
                className="textarea"
                placeholder="Add a comment..."
                value={commentBody}
                maxLength={2000}
                onChange={(event) => setCommentBody(event.target.value)}
              />
              <button
                className="btn"
                type="submit"
                disabled={commentSaving || commentBody.trim().length === 0}
                style={{ marginTop: 10 }}
              >
                {commentSaving ? "Adding..." : "Add comment"}
              </button>
            </form>
          )}
          {timelineError && (
            <p className="dim" style={{ color: "var(--danger)" }}>
              {timelineError}
            </p>
          )}
          {timeline.length === 0 ? (
            <p className="dim" style={{ color: "var(--text-muted)" }}>
              No comments or activity yet.
            </p>
          ) : (
            <ul className="pub-list">
              {timeline.map((item) => {
                const actor =
                  item.kind === "comment"
                    ? item.comment.authorEmail
                    : item.activity.actorEmail ?? "System";
                const label =
                  item.kind === "comment" ? "added a comment" : item.activity.summary;
                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    style={{ alignItems: "flex-start", flexDirection: "column" }}
                  >
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {actor} {label} - {formatTimelineDate(item.createdAt)}
                    </span>
                    {item.kind === "comment" ? (
                      <span style={{ whiteSpace: "pre-wrap" }}>
                        {item.comment.body}
                      </span>
                    ) : (
                      <span>{item.activity.type.replace(".", " ")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <AppFooter />

      {bundlePickerOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Add to bundles"
          onClick={() => setBundlePickerOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="section-title" style={{ margin: 0 }}>
                Add to bundles
              </h3>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setBundlePickerOpen(false)}
              >
                ×
              </button>
            </div>

            {availableBundles.length === 0 ? (
              <p className="dim" style={{ color: "var(--text-muted)" }}>
                {allBundles.length === 0 ? (
                  <>
                    No bundles yet. <Link href="/bundles">Create one</Link>.
                  </>
                ) : (
                  "This asset is already in every bundle."
                )}
              </p>
            ) : (
              <div className="modal-list">
                {availableBundles.map((b) => (
                  <label key={b.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={pickerSelection.has(b.id)}
                      onChange={() => togglePick(b.id)}
                    />
                    <span>{b.title}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setBundlePickerOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={confirmAddToBundles}
                disabled={pickerSelection.size === 0 || bundleSaving}
              >
                {bundleSaving
                  ? "Adding..."
                  : `Add to ${pickerSelection.size || ""} ${
                      pickerSelection.size === 1 ? "bundle" : "bundles"
                    }`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
