"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context.js";
import type {
  AssetDTO,
  ChannelInfoLike,
  PublicationDTO,
} from "../../../lib/types.js";

export default function AssetDetailPage() {
  const { client } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [asset, setAsset] = useState<AssetDTO | null>(null);
  const [channels, setChannels] = useState<ChannelInfoLike[]>([]);
  const [publications, setPublications] = useState<PublicationDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

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
  };

  const publish = async () => {
    if (selected.length === 0) return;
    await client.publish(id, selected);
    setTimeout(load, 500);
  };

  const remove = async () => {
    await client.deleteAsset(id);
    router.push("/");
  };

  if (!asset) {
    return (
      <div className="container">
        <p>Loading…</p>
      </div>
    );
  }

  const standard =
    asset.renditions.find((r) => r.name === "standard") ??
    asset.renditions.find((r) => r.name === "original");

  return (
    <>
      <div className="header">
        <Link href="/">← Back</Link>
        <button className="btn secondary" onClick={remove}>
          Delete
        </button>
      </div>
      <div className="container" style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          {standard && (
            <img
              src={standard.url}
              alt={asset.altText ?? asset.originalName}
              style={{ width: "100%", borderRadius: 8 }}
            />
          )}
          <p>
            Status: <span className={`badge ${asset.status}`}>{asset.status}</span>
          </p>
          <p>
            {asset.width}×{asset.height} · {asset.format} ·{" "}
            {Math.round(asset.sizeBytes / 1024)} KB
          </p>
          <h3>Renditions</h3>
          <ul>
            {asset.renditions.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.name}
                </a>{" "}
                ({r.width}×{r.height})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Metadata</h3>
          <label>Title</label>
          <input
            className="input"
            defaultValue={asset.title ?? ""}
            onBlur={(e) => save({ title: e.target.value })}
          />
          <label>Description</label>
          <textarea
            className="input"
            defaultValue={asset.description ?? ""}
            onBlur={(e) => save({ description: e.target.value })}
          />
          <label>Alt text</label>
          <input
            className="input"
            defaultValue={asset.altText ?? ""}
            onBlur={(e) => save({ altText: e.target.value })}
          />
          <label>Tags (comma separated)</label>
          <input
            className="input"
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

          <h3>Publish</h3>
          {channels.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
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
              />{" "}
              {c.label}
            </label>
          ))}
          <button className="btn" onClick={publish} style={{ marginTop: 12 }}>
            Publish
          </button>

          <h3>Publish history</h3>
          {publications.length === 0 ? (
            <p>Not published yet.</p>
          ) : (
            <ul>
              {publications.map((p) => (
                <li key={p.id}>
                  {p.channelId} —{" "}
                  <span className={`badge ${p.status === "success" ? "ready" : "failed"}`}>
                    {p.status}
                  </span>{" "}
                  {p.reference && (
                    <a href={p.reference} target="_blank" rel="noreferrer">
                      link
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
