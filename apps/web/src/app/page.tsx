"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppFooter } from "./AppFooter";
import { useAuth } from "../lib/client-context";
import type { AssetDTO } from "../lib/types";

function isExpired(value: string | null): boolean {
  return value !== null && new Date(value).getTime() < Date.now();
}

function isPdf(asset: AssetDTO): boolean {
  return asset.format.toLowerCase() === "pdf";
}

function galleryImageSources(asset: AssetDTO): {
  src: string;
  srcSet?: string;
} | null {
  const candidates = ["thumb", "standard", "large"] as const;
  const renditions = candidates
    .map((name) => asset.renditions.find((r) => r.name === name))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (renditions.length === 0) return null;

  const srcSet = renditions
    .map((r) => `${r.url} ${Math.max(r.width, r.height)}w`)
    .join(", ");
  const standard =
    asset.renditions.find((r) => r.name === "standard") ??
    asset.renditions.find((r) => r.name === "large") ??
    renditions[0]!;

  return { src: standard.url, srcSet };
}

export default function GalleryPage() {
  const {
    client,
    isAuthenticated,
    accounts,
    activeAccount,
    permissions,
    switchAccount,
  } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const canUpload = permissions.includes("assets:create");

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
  }, [isAuthenticated, activeAccount?.account.id]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const failed: string[] = [];
    setUploading(true);
    setUploadProgress(files.length > 1 ? { current: 0, total: files.length } : null);
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress(
          files.length > 1 ? { current: index + 1, total: files.length } : null,
        );
        try {
          await client.uploadAsset(file);
        } catch {
          failed.push(file.name);
        }
      }
      await refresh();
      if (failed.length > 0) {
        alert(`Upload failed for:\n${failed.join("\n")}`);
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const uploadLabel =
    uploading && uploadProgress
      ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`
      : uploading
        ? "Uploading..."
        : "Upload asset";

  return (
    <>
      <header className="appbar">
        <div className="brand">Asset gallery</div>
        <div className="appbar-actions">
          {accounts.length > 0 && (
            <select
              className="input account-select"
              value={activeAccount?.account.id ?? ""}
              onChange={(e) => switchAccount(e.target.value)}
              aria-label="Active account"
            >
              {accounts.map((ctx) => (
                <option key={ctx.account.id} value={ctx.account.id}>
                  {ctx.account.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn"
            disabled={uploading || !canUpload}
            onClick={() => fileInput.current?.click()}
          >
            <span aria-hidden>＋</span>
            <span className="btn-label">{uploadLabel}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            multiple
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
            <p>Upload your first image or PDF to get started.</p>
            <button
              className="btn"
              disabled={uploading || !canUpload}
              onClick={() => fileInput.current?.click()}
            >
              {uploadLabel}
            </button>
          </div>
        ) : (
          <div className="grid">
            {assets.map((a) => {
              const imageSources = galleryImageSources(a);
              const expired = isExpired(a.expiresAt);
              const pdf = isPdf(a);
              return (
                <Link key={a.id} href={`/assets/${a.id}`} className="card">
                  {pdf && !imageSources ? (
                    <div className="thumb placeholder">PDF document</div>
                  ) : imageSources ? (
                    <img
                      className="thumb"
                      src={imageSources.src}
                      srcSet={imageSources.srcSet}
                      sizes="(max-width: 700px) 50vw, (max-width: 1200px) 33vw, 280px"
                      alt={a.title ?? a.originalName}
                    />
                  ) : (
                    <div className="thumb placeholder">Processing…</div>
                  )}
                  <div className="meta">
                    <div className="title">{a.title ?? a.originalName}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className={`badge ${a.status}`}>{a.status}</span>
                      {pdf && <span className="badge">PDF</span>}
                      {expired && <span className="badge failed">Expired</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <AppFooter />
    </>
  );
}
