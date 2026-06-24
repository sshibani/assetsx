"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../lib/client-context";
import type { PublicBundleDTO } from "../../../../lib/types";

export default function SharedBundlePage() {
  const { client } = useAuth();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [bundle, setBundle] = useState<PublicBundleDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client
      .getSharedBundle(token)
      .then((b) => {
        setBundle(b);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="center-state">
        <div className="spinner" />
        <p>Loading shared bundle...</p>
      </div>
    );
  }

  if (notFound || !bundle) {
    return (
      <div className="center-state">
        <h2>Link unavailable</h2>
        <p>This share link is invalid, has expired, or was revoked.</p>
      </div>
    );
  }

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          AssetX
        </div>
      </header>

      <main className="container">
        <div className="panel" style={{ marginBottom: 24 }}>
          <h2 className="section-title">{bundle.title}</h2>
          {bundle.description && (
            <p style={{ color: "var(--text-muted)" }}>{bundle.description}</p>
          )}
        </div>

        {bundle.items.length === 0 ? (
          <div className="center-state">
            <p>This bundle has no assets.</p>
          </div>
        ) : (
          <div className="grid">
            {bundle.items.map((item) => {
              const asset = item.asset;
              const thumb = asset.renditions.find((r) => r.name === "thumb");
              const standard =
                asset.renditions.find((r) => r.name === "standard") ?? thumb;
              return (
                <div key={item.assetId} className="card">
                  {standard ? (
                    <img
                      className="thumb"
                      src={standard.url}
                      alt={asset.title ?? asset.originalName}
                    />
                  ) : (
                    <div className="thumb placeholder">
                      {asset.format.toUpperCase()}
                    </div>
                  )}
                  <div className="meta">
                    <div className="title">
                      {asset.title ?? asset.originalName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
