"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/client-context";
import type { BundleDTO } from "../../lib/types";

export default function BundlesPage() {
  const { client, isAuthenticated, activeAccount, hasPermission } = useAuth();
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || creating) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await client.createBundle({
        title: trimmed,
        description: description.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="appbar">
        <Link href="/" className="brand" style={{ fontSize: 16 }}>
          <span aria-hidden>{"<-"}</span> Back to gallery
        </Link>
        <div className="appbar-actions">
          <span className="brand" style={{ fontSize: 16 }}>
            Bundles
          </span>
        </div>
      </header>

      <main className="container">
        {canCreate && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <h3 className="section-title">Create a bundle</h3>
            <form
              onSubmit={onCreate}
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              <input
                className="input"
                placeholder="Bundle title"
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="input"
                placeholder="Description (optional)"
                value={description}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
              />
              <button
                className="btn"
                type="submit"
                disabled={creating || title.trim().length === 0}
              >
                {creating ? "Creating..." : "Create bundle"}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="center-state">
            <div className="spinner" />
            <p>Loading your bundles…</p>
          </div>
        ) : bundles.length === 0 ? (
          <div className="center-state">
            <h2>No bundles yet</h2>
            <p>Create a bundle to group assets into a collection.</p>
          </div>
        ) : (
          <div className="grid">
            {bundles.map((b) => (
              <Link key={b.id} href={`/bundles/${b.id}`} className="card">
                <div className="thumb placeholder">
                  {b.assetCount} {b.assetCount === 1 ? "asset" : "assets"}
                </div>
                <div className="meta">
                  <div className="title">{b.title}</div>
                  {b.description && (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {b.description}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
