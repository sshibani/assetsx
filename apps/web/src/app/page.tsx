"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/client-context.js";
import type { AssetDTO } from "../lib/types.js";

export default function GalleryPage() {
  const { client, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { items } = await client.listAssets();
    setAssets(items);
    setLoading(false);
  };

  useEffect(() => {
    // wait a tick for token hydration
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      refresh().catch(() => router.push("/login"));
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await client.uploadAsset(file);
      await refresh();
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <>
      <div className="header">
        <strong>AssetX</strong>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          <button className="btn secondary" onClick={logout}>
            Log out
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={onUpload}
          />
        </div>
      </div>
      <div className="container">
        {loading ? (
          <p>Loading…</p>
        ) : assets.length === 0 ? (
          <p>No assets yet. Upload your first image.</p>
        ) : (
          <div className="grid">
            {assets.map((a) => {
              const thumb = a.renditions.find((r) => r.name === "thumb");
              return (
                <Link key={a.id} href={`/assets/${a.id}`} className="card">
                  {thumb ? (
                    <img src={thumb.url} alt={a.altText ?? a.originalName} />
                  ) : (
                    <div style={{ height: 160 }} />
                  )}
                  <div className="meta">
                    <div>{a.title ?? a.originalName}</div>
                    <span className={`badge ${a.status}`}>{a.status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
