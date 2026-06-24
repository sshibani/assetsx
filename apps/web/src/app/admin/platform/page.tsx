"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context";
import { ApiError } from "../../../lib/api-client";
import type { AdminUserDTO, GlobalRole } from "../../../lib/types";

export default function PlatformAdminPage() {
  const { isSuperUser, isAuthenticated, client } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const { items } = await client.listAdminUsers(q);
        setUsers(items);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError ? `Failed to load (HTTP ${err.status})` : "Failed to load",
        );
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      if (isSuperUser) load();
      else setLoading(false);
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSuperUser]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(query || undefined);
  };

  const setRole = async (userId: string, globalRole: GlobalRole) => {
    try {
      await client.setUserGlobalRole(userId, globalRole);
      await load(query || undefined);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Cannot demote the last super user");
      } else {
        setError("Operation failed");
      }
    }
  };

  if (!isSuperUser) {
    return (
      <main className="container">
        <h2>Platform administration</h2>
        <p>This area is restricted to super users.</p>
        <Link href="/">Back to gallery</Link>
      </main>
    );
  }

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          AssetX · Platform admin
        </div>
        <div className="appbar-actions">
          <Link className="btn secondary" href="/">
            Back to gallery
          </Link>
        </div>
      </header>

      <main className="container">
        <h2>Users</h2>
        {error && <div className="error-text">{error}</div>}
        <form onSubmit={onSearch} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Search by email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>

        {loading ? (
          <div className="center-state">
            <div className="spinner" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Global role</th>
                <th>Accounts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <span
                      className={`badge ${u.globalRole === "super_user" ? "ready" : ""}`}
                    >
                      {u.globalRole}
                    </span>
                  </td>
                  <td>{u.accountCount}</td>
                  <td>
                    {u.globalRole === "super_user" ? (
                      <button
                        className="btn secondary"
                        onClick={() => setRole(u.id, "user")}
                      >
                        Demote to user
                      </button>
                    ) : (
                      <button
                        className="btn secondary"
                        onClick={() => setRole(u.id, "super_user")}
                      >
                        Promote to super user
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
