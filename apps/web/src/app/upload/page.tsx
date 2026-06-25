"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/client-context";
import { Icon } from "../../components/ui/Icon";
import { formatBytes } from "../../lib/vault/format";
import type { BundleDTO } from "../../lib/types";

interface QueueItem {
  id: string;
  name: string;
  sizeBytes: number;
  progress: number; // 0..100
  status: "queued" | "uploading" | "done" | "error";
}

export default function UploadPage() {
  const { client, isAuthenticated, hasPermission } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [bundles, setBundles] = useState<BundleDTO[]>([]);
  const [selectedBundles, setSelectedBundles] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const canUpload = hasPermission("assets:create");

  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      setReady(true);
      client
        .listBundles()
        .then((r) => setBundles(r.items))
        .catch(() => setBundles([]));
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const toggleBundle = (id: string) =>
    setSelectedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const handleFiles = async (files: File[]) => {
    if (!canUpload || files.length === 0) return;
    const items: QueueItem[] = files.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      sizeBytes: f.size,
      progress: 0,
      status: "queued",
    }));
    setQueue((prev) => [...prev, ...items]);

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      const item = items[i]!;
      setItem(item.id, { status: "uploading", progress: 35 });
      try {
        const asset = await client.uploadAsset(file);
        // Apply tags (if any) to the newly uploaded asset.
        if (tags.length > 0) {
          await client.updateAsset(asset.id, { tags }).catch(() => undefined);
        }
        // Add to any selected bundles.
        if (selectedBundles.size > 0) {
          await Promise.allSettled(
            [...selectedBundles].map((bundleId) =>
              client.addAssetToBundle(bundleId, asset.id),
            ),
          );
        }
        // TODO(ASS-54): apply visibility on upload once backend supports it.
        setItem(item.id, { status: "done", progress: 100 });
      } catch {
        setItem(item.id, { status: "error", progress: 0 });
      }
    }
  };

  if (!ready) {
    return (
      <div className="vault-empty">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  const completed = queue.filter((q) => q.status === "done").length;

  return (
    <>
      <div className="vault-view-header">
        <div className="vault-breadcrumb">
          <Link href="/">All assets</Link> / Upload
        </div>
        <h1 className="vault-view-title">Upload assets</h1>
      </div>

      <div className="vault-main-scroll">
        <div className="vault-scroll-body">
          <div className="vault-two-col">
            <div>
              <div
                className={`vault-dropzone${drag ? " drag" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  void handleFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <div className="vault-dropzone-icon">
                  <Icon name="upload" size={26} />
                </div>
                <div className="vault-dropzone-title">Drag and drop files here</div>
                <div className="vault-dropzone-help">
                  or browse from your device. Supports JPG, PNG, SVG, PDF and DOCX up to 2 GB each.
                </div>
                <button
                  className="vault-btn"
                  disabled={!canUpload}
                  onClick={() => fileInput.current?.click()}
                >
                  Browse files
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
                />
              </div>

              {queue.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>Uploading · {queue.length} files</strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      {completed} of {queue.length} complete
                    </span>
                  </div>
                  {queue.map((q) => (
                    <div key={q.id} className="vault-queue-row">
                      <span className="vault-queue-thumb" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {q.name}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: q.status === "done" ? "var(--success)" : q.status === "error" ? "var(--danger-fg)" : "var(--brand)",
                            }}
                          >
                            {q.status === "done"
                              ? "Done"
                              : q.status === "error"
                                ? "Failed"
                                : `${q.progress}%`}
                          </span>
                        </div>
                        <div className="vault-progress">
                          <div
                            className={`vault-progress-fill${q.status === "done" ? " done" : ""}`}
                            style={{ width: `${q.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Apply to all */}
            <div className="vault-panel" style={{ alignSelf: "start" }}>
              <h3 className="vault-section-label">Apply to all</h3>
              <div className="vault-field">
                <label className="vault-field-label">Bundles</label>
                {bundles.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                    No bundles yet. <Link href="/bundles">Create one</Link>.
                  </p>
                ) : (
                  <div
                    style={{
                      maxHeight: 160,
                      overflowY: "auto",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 6,
                    }}
                  >
                    {bundles.map((b) => (
                      <label
                        key={b.id}
                        className="vault-list-row"
                        style={{ padding: "6px 8px", cursor: "pointer", gap: 10 }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBundles.has(b.id)}
                          onChange={() => toggleBundle(b.id)}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{b.title}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {b.assetCount} {b.assetCount === 1 ? "asset" : "assets"}
                          </div>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedBundles.size > 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                    Uploaded assets will be added to {selectedBundles.size}{" "}
                    {selectedBundles.size === 1 ? "bundle" : "bundles"}.
                  </p>
                )}
              </div>
              <div className="vault-field">
                <label className="vault-field-label">Tags</label>
                <input
                  className="vault-input"
                  placeholder="Add a tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setTags((t) => [...new Set([...t, tagInput.trim()])]);
                      setTagInput("");
                    }
                  }}
                />
                {tags.length > 0 && (
                  <div className="vault-tag-row" style={{ marginTop: 8 }}>
                    {tags.map((t) => (
                      <span key={t} className="vault-tag" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                        {t}
                        <button
                          style={{ marginLeft: 6, border: "none", background: "none", cursor: "pointer", color: "inherit" }}
                          onClick={() => setTags((cur) => cur.filter((x) => x !== t))}
                          aria-label={`Remove ${t}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* TODO(ASS-45): persist tags on uploaded assets. */}
              </div>
              <div className="vault-field">
                <label className="vault-field-label">Visibility</label>
                <div className="vault-radio-cards">
                  <div
                    className={`vault-radio-card${visibility === "workspace" ? " selected" : ""}`}
                    onClick={() => setVisibility("workspace")}
                  >
                    Workspace
                  </div>
                  <div
                    className={`vault-radio-card${visibility === "private" ? " selected" : ""}`}
                    onClick={() => setVisibility("private")}
                  >
                    Private
                  </div>
                </div>
              </div>
              <button
                className="vault-btn-primary block"
                disabled={!canUpload}
                onClick={() => fileInput.current?.click()}
              >
                {queue.length > 0
                  ? `${formatBytes(queue.reduce((s, q) => s + q.sizeBytes, 0))} queued`
                  : "Select files to publish"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
