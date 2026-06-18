"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../lib/client-context";
import type { AssetDTO } from "../lib/types";

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
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          AssetX
        </div>
        <div className="appbar-actions">
          <button
            className="btn"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <span aria-hidden>＋</span>
            <span className="btn-label">
              {uploading ? "Uploading…" : "Upload image"}
            </span>
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
      </header>

      <main className="container">
        {loading ? (
          <div className="center-state">
            <div className="spinner" />
            <p>Loading your assets…</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="center-state">
            <h2>No assets yet</h2>
            <p>Upload your first image to get started.</p>
            <button
              className="btn"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload image"}
            </button>
          </div>
        ) : (
          <div className="grid">
            {assets.map((a) => {
              const thumb = a.renditions.find((r) => r.name === "thumb");
              return (
                <Link key={a.id} href={`/assets/${a.id}`} className="card">
                  {thumb ? (
                    <img
                      className="thumb"
                      src={thumb.url}
                      alt={a.title ?? a.originalName}
                    />
                  ) : (
                    <div className="thumb placeholder">Processing…</div>
                  )}
                  <div className="meta">
                    <div className="title">{a.title ?? a.originalName}</div>
                    <span className={`badge ${a.status}`}>{a.status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
