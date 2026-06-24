"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context";
import { ApiError } from "../../../lib/api-client";
import { formatterForSettings } from "../../../lib/datetime";
import type {
  AdminAccountDTO,
  AdminUserDTO,
  GlobalRole,
} from "../../../lib/types";

type Tab = "accounts" | "users";

export default function PlatformAdminPage() {
  const { isSuperUser, isAuthenticated, client } = useAuth();
  const router = useRouter();
  // Platform admin spans accounts; use default (ISO/UTC) date formatting.
  const formatDate = formatterForSettings(null);

  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<AdminAccountDTO[]>([]);
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (which: Tab, q?: string) => {
      setLoading(true);
      try {
        if (which === "accounts") {
          const { items } = await client.listAdminAccounts(q);
          setAccounts(items);
        } else {
          const { items } = await client.listAdminUsers(q);
          setUsers(items);
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? `Failed to load (HTTP ${err.status})`
            : "Failed to load",
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
      if (isSuperUser) load(tab, query || undefined);
      else setLoading(false);
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSuperUser, tab]);

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    setQuery("");
    setTab(next);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(tab, query || undefined);
  };

  const setRole = async (userId: string, globalRole: GlobalRole) => {
    try {
      await client.setUserGlobalRole(userId, globalRole);
      await load("users", query || undefined);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Cannot demote the last super user");
      } else {
        setError("Operation failed");
      }
    }
  };

  const setAccountStatus = async (
    accountId: string,
    status: "active" | "disabled",
  ) => {
    try {
      await client.updateAccount(accountId, { status });
      await load("accounts", query || undefined);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Operation failed (HTTP ${err.status})`);
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
        <div className="tabs">
          <button
            className={`tab ${tab === "accounts" ? "active" : ""}`}
            onClick={() => switchTab("accounts")}
          >
            Accounts
          </button>
          <button
            className={`tab ${tab === "users" ? "active" : ""}`}
            onClick={() => switchTab("users")}
          >
            Users
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        <form
          onSubmit={onSearch}
          style={{ display: "flex", gap: 8, margin: "16px 0" }}
        >
          <input
            className="input"
            placeholder={
              tab === "accounts"
                ? "Search by name or slug…"
                : "Search by email…"
            }
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
        ) : tab === "accounts" ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Members</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.slug}</td>
                  <td>
                    <span
                      className={`badge ${a.status === "active" ? "ready" : "failed"}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td>{a.memberCount}</td>
                  <td>{formatDate(a.createdAt)}</td>
                  <td>
                    {a.status === "active" ? (
                      <button
                        className="btn secondary"
                        onClick={() => setAccountStatus(a.id, "disabled")}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        className="btn secondary"
                        onClick={() => setAccountStatus(a.id, "active")}
                      >
                        Enable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6}>No accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={4}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
