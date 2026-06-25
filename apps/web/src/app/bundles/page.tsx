"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/client-context";
import type { BundleDTO } from "../../lib/types";
import { relativeTime } from "../../lib/vault/format";
import { Icon } from "../../components/ui/Icon";
import { CreateBundleModal } from "../../components/vault/modals";

function Collage({ count, covers }: { count: number; covers: string[] }) {
  // The collage shows up to 3 tiles (one large + two stacked); the last tile
  // carries a "+N" overlay for the remaining assets.
  const extra = Math.max(count - 3, 0);
  const tiles = [0, 1, 2];
  return (
    <div className="vault-collage">
      {tiles.map((i) => (
        <div key={i} className="vault-collage-tile">
          {covers[i] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={covers[i]} alt="" loading="lazy" />
          )}
          {i === 2 && extra > 0 && <div className="vault-collage-more">+{extra}</div>}
        </div>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<string, { dot: string; text: string }> = {
  private: { dot: "var(--text-faint)", text: "Private" },
  internal: { dot: "var(--brand)", text: "Shared internally" },
  external: { dot: "var(--success)", text: "Shared externally" },
};

export default function BundlesPage() {
  const { client, isAuthenticated, activeAccount, hasPermission } = useAuth();
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const canCreate = hasPermission("bundles:create");

  const refresh = async () => {
    const { items } = await client.listBundles();
    setBundles(items);
    setLoading(false);
  };

  useEffect(() => {
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

  return (
    <>
      <div className="vault-view-header">
        <div className="vault-header-row">
          <div>
            <h1 className="vault-view-title">Bundles</h1>
            <div className="vault-view-sub">
              Curated sets of assets you can share or hand off as a kit.
            </div>
          </div>
          {canCreate && (
            <button className="vault-btn brand" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} />
              New bundle
            </button>
          )}
        </div>
      </div>

      <div className="vault-main-scroll">
        <div className="vault-scroll-body">
          {loading ? (
            <div className="vault-empty">
              <div className="spinner" />
              <p>Loading your bundles…</p>
            </div>
          ) : bundles.length === 0 ? (
            <div className="vault-empty">
              <h2>No bundles yet</h2>
              <p>Create a bundle to group assets into a shareable kit.</p>
            </div>
          ) : (
            <div className="vault-bundle-grid">
              {bundles.map((b) => {
                const status = STATUS_LABEL.private!;
                return (
                  <div
                    key={b.id}
                    className="vault-card"
                    onClick={() => router.push(`/bundles/${b.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/bundles/${b.id}`);
                    }}
                  >
                    <Collage count={b.assetCount} covers={b.coverUrls ?? []} />
                    <div className="vault-card-meta">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <span className="vault-dot" style={{ background: status.dot }} />
                        {status.text}
                      </div>
                      <div className="vault-display" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                        {b.title}
                      </div>
                      <div className="vault-card-sub">
                        {b.assetCount} {b.assetCount === 1 ? "asset" : "assets"} · updated {relativeTime(b.updatedAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {creating && (
        <CreateBundleModal onClose={() => setCreating(false)} onCreated={() => refresh()} />
      )}
    </>
  );
}
