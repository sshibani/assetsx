"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context";
import type {
  AssetDTO,
  ChannelInfoLike,
  PublicationDTO,
} from "../../../lib/types";

function formatCreatedAt(value: string): string {
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

export default function AssetDetailPage() {
  const { client } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [asset, setAsset] = useState<AssetDTO | null>(null);
  const [channels, setChannels] = useState<ChannelInfoLike[]>([]);
  const [publications, setPublications] = useState<PublicationDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const [a, ch, pubs] = await Promise.all([
      client.getAsset(id),
      client.listChannels(),
      client.listPublications(id),
    ]);
    setAsset(a);
    setChannels(ch.items);
    setPublications(pubs.items);
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
    const updated = await client.updateAsset(id, data);
    setAsset(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const publish = async () => {
    if (selected.length === 0) return;
    await client.publish(id, selected);
    setTimeout(load, 600);
  };

  const remove = async () => {
    if (!confirm("Delete this asset and all its renditions?")) return;
    await client.deleteAsset(id);
    router.push("/");
  };

  if (!asset) {
    return (
      <div className="center-state">
        <div className="spinner" />
        <p>Loading asset…</p>
      </div>
    );
  }

  const standard =
    asset.renditions.find((r) => r.name === "standard") ??
    asset.renditions.find((r) => r.name === "original");

  return (
    <>
      <header className="appbar">
        <Link href="/" className="brand" style={{ fontSize: 16 }}>
          <span aria-hidden>←</span> Back to gallery
        </Link>
        <div className="appbar-actions">
          {saved && (
            <span className="badge ready" style={{ alignSelf: "center" }}>
              Saved
            </span>
          )}
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
        </div>
      </header>

      <main className="container">
        <div className="detail-grid">
          {/* Left: preview + renditions */}
          <div>
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              {standard && (
                <img
                  className="preview"
                  src={standard.url}
                  alt={asset.altText ?? asset.originalName}
                  style={{ border: "none", borderRadius: 0 }}
                />
              )}
              <div style={{ padding: "18px 20px" }}>
                <div className="kv">
                  <span className={`badge ${asset.status}`}>{asset.status}</span>
                  <span>
                    {asset.width ?? "?"}×{asset.height ?? "?"}
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
                      {r.width}×{r.height} · {r.format}
                    </span>
                  </li>
                ))}
                {asset.renditions.length === 0 && (
                  <li className="dim">Renditions are still being generated…</li>
                )}
              </ul>
            </div>
          </div>

          {/* Right: metadata + publish */}
          <div>
            <div className="panel">
              <h3 className="section-title">Metadata</h3>
              <div className="field">
                <label className="label">Title</label>
                <input
                  className="input"
                  placeholder="Untitled"
                  defaultValue={asset.title ?? ""}
                  onBlur={(e) => save({ title: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Description</label>
                <textarea
                  className="textarea"
                  placeholder="Describe this asset…"
                  defaultValue={asset.description ?? ""}
                  onBlur={(e) => save({ description: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Alt text</label>
                <input
                  className="input"
                  placeholder="Accessible description"
                  defaultValue={asset.altText ?? ""}
                  onBlur={(e) => save({ altText: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">Tags (comma separated)</label>
                <input
                  className="input"
                  placeholder="nature, sky, blue"
                  defaultValue={asset.tags.join(", ")}
                  onBlur={(e) =>
                    save({
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
                <label className="label">Expiry date</label>
                <input
                  className="input"
                  type="date"
                  defaultValue={expiryInputValue(asset.expiresAt)}
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
                disabled={selected.length === 0}
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
                          Open ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
