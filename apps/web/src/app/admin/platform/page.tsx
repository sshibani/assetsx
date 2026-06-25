"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppFooter } from "../../AppFooter";
import { useAuth } from "../../../lib/client-context";
import { ApiError } from "../../../lib/api-client";
import { useTranslation } from "../../../lib/i18n";
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
  const { t } = useTranslation();
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
    const timer = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      if (isSuperUser) load(tab, query || undefined);
      else setLoading(false);
    }, 50);
    return () => clearTimeout(timer);
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
      <>
        <main className="container">
          <h2>{t("admin.platform.title")}</h2>
          <p>{t("admin.platform.restricted")}</p>
          <Link href="/">{t("admin.backToGallery")}</Link>
        </main>
        <AppFooter />
      </>
    );
  }

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          {t("admin.platform.brand")}
        </div>
        <div className="appbar-actions">
          <Link className="btn secondary" href="/">
            {t("admin.backToGallery")}
          </Link>
        </div>
      </header>

      <main className="container">
        <div className="tabs">
          <button
            className={`tab ${tab === "accounts" ? "active" : ""}`}
            onClick={() => switchTab("accounts")}
          >
            {t("admin.platform.tabAccounts")}
          </button>
          <button
            className={`tab ${tab === "users" ? "active" : ""}`}
            onClick={() => switchTab("users")}
          >
            {t("admin.platform.tabUsers")}
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
                ? t("admin.platform.searchAccounts")
                : t("admin.platform.searchUsers")
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" type="submit">
            {t("common.search")}
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
                <th>{t("admin.platform.col.name")}</th>
                <th>{t("admin.platform.col.slug")}</th>
                <th>{t("admin.col.status")}</th>
                <th>{t("admin.platform.col.members")}</th>
                <th>{t("admin.platform.col.created")}</th>
                <th>{t("admin.col.actions")}</th>
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
                      {t(`status.${a.status}`)}
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
                        {t("admin.disable")}
                      </button>
                    ) : (
                      <button
                        className="btn secondary"
                        onClick={() => setAccountStatus(a.id, "active")}
                      >
                        {t("admin.enable")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6}>{t("admin.platform.noAccounts")}</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("admin.col.email")}</th>
                <th>{t("admin.platform.col.globalRole")}</th>
                <th>{t("admin.platform.col.accounts")}</th>
                <th>{t("admin.col.actions")}</th>
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
                      {t(`globalRole.${u.globalRole}`)}
                    </span>
                  </td>
                  <td>{u.accountCount}</td>
                  <td>
                    {u.globalRole === "super_user" ? (
                      <button
                        className="btn secondary"
                        onClick={() => setRole(u.id, "user")}
                      >
                        {t("admin.platform.demote")}
                      </button>
                    ) : (
                      <button
                        className="btn secondary"
                        onClick={() => setRole(u.id, "super_user")}
                      >
                        {t("admin.platform.promote")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4}>{t("admin.platform.noUsers")}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </main>
      <AppFooter />
    </>
  );
}
