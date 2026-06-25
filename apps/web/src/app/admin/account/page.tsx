"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppFooter } from "../../AppFooter";
import { useAuth } from "../../../lib/client-context";
import { ApiError } from "../../../lib/api-client";
import { useTranslation } from "../../../lib/i18n";
import { ACCOUNT_ROLES, DATE_TIME_FORMATS } from "@assetx/shared-types";
import type {
  AccountMembershipDTO,
  AccountRole,
  AccountSettingsDTO,
  DateTimeFormat,
} from "../../../lib/types";

export default function AccountAdminPage() {
  const { activeAccount, hasPermission, isAuthenticated, client } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const accountId = activeAccount?.account.id ?? null;

  const canManageMembers = hasPermission("members:manage");
  const canManageAdmins = hasPermission("members:manage_admins");
  const canUpdate = hasPermission("account:update");

  const [members, setMembers] = useState<AccountMembershipDTO[]>([]);
  const [settings, setSettings] = useState<AccountSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AccountRole>("account_viewer");

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        client.listMembers(accountId),
        client.getAccountSettings(accountId),
      ]);
      setMembers(m.items);
      setSettings(s);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? `Failed to load (HTTP ${err.status})` : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accountId, client]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      load();
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accountId]);

  const handle = async (fn: () => Promise<unknown>, conflictMsg?: string) => {
    try {
      await fn();
      await load();
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(conflictMsg ?? "Operation not allowed");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("You do not have permission for that action");
      } else if (err instanceof ApiError && err.status === 404) {
        setError("That user does not exist");
      } else {
        setError("Operation failed");
      }
    }
  };

  const onAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !newEmail) return;
    await handle(async () => {
      await client.addMember(accountId, newEmail, newRole);
      setNewEmail("");
      setNewRole("account_viewer");
    });
  };

  if (!accountId) {
    return (
      <>
        <main className="container">
          <p>{t("admin.account.noActive")}</p>
        </main>
        <AppFooter />
      </>
    );
  }

  if (!canManageMembers && !canUpdate) {
    return (
      <>
        <main className="container">
          <h2>{t("admin.account.title")}</h2>
          <p>{t("admin.account.noPermission")}</p>
          <Link href="/">{t("admin.backToGallery")}</Link>
        </main>
        <AppFooter />
      </>
    );
  }

  const roleOptions = (current: AccountRole): AccountRole[] =>
    ACCOUNT_ROLES.filter((r) =>
      r === "account_owner" ? canManageAdmins || current === "account_owner" : true,
    ) as AccountRole[];

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          {t("admin.account.brand")}
        </div>
        <div className="appbar-actions">
          <Link className="btn secondary" href="/">
            {t("admin.backToGallery")}
          </Link>
        </div>
      </header>

      <main className="container">
        <h2>{t("admin.account.heading", { name: activeAccount?.account.name ?? "" })}</h2>
        {error && <div className="error-text">{error}</div>}
        {loading ? (
          <div className="center-state">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <section style={{ marginTop: 24 }}>
              <h3>{t("admin.account.members")}</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("admin.col.email")}</th>
                    <th>{t("admin.col.role")}</th>
                    <th>{t("admin.col.status")}</th>
                    {canManageMembers && <th>{t("admin.col.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isOwner = m.role === "account_owner";
                    const editable =
                      canManageMembers && (!isOwner || canManageAdmins);
                    return (
                      <tr key={m.id}>
                        <td>{m.email}</td>
                        <td>
                          {editable ? (
                            <select
                              className="input"
                              value={m.role}
                              onChange={(e) =>
                                handle(
                                  () =>
                                    client.updateMember(accountId, m.id, {
                                      role: e.target.value as AccountRole,
                                    }),
                                  "Cannot remove the last account owner",
                                )
                              }
                            >
                              {roleOptions(m.role).map((r) => (
                                <option key={r} value={r}>
                                  {t(`role.${r}`)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            t(`role.${m.role}`)
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${m.status === "active" ? "ready" : "failed"}`}
                          >
                            {t(`status.${m.status}`)}
                          </span>
                        </td>
                        {canManageMembers && (
                          <td>
                            {editable && (
                              <>
                                <button
                                  className="btn secondary"
                                  onClick={() =>
                                    handle(
                                      () =>
                                        client.updateMember(accountId, m.id, {
                                          status:
                                            m.status === "active"
                                              ? "disabled"
                                              : "active",
                                        }),
                                      "Cannot disable the last account owner",
                                    )
                                  }
                                >
                                  {m.status === "active" ? t("admin.disable") : t("admin.enable")}
                                </button>{" "}
                                <button
                                  className="btn secondary"
                                  onClick={() =>
                                    handle(
                                      () => client.removeMember(accountId, m.id),
                                      "Cannot remove the last account owner",
                                    )
                                  }
                                >
                                  {t("common.remove")}
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {canManageMembers && (
                <form
                  onSubmit={onAddMember}
                  style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
                >
                  <input
                    className="input"
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <select
                    className="input"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as AccountRole)}
                  >
                    {roleOptions("account_viewer").map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </select>
                  <button className="btn" type="submit">
                    {t("admin.account.addMember")}
                  </button>
                </form>
              )}
            </section>

            {canUpdate && settings && (
              <section style={{ marginTop: 32 }}>
                <h3>{t("admin.account.settings")}</h3>
                <div className="field">
                  <label className="label" htmlFor="dtf">
                    {t("admin.account.dateFormat")}
                  </label>
                  <select
                    id="dtf"
                    className="input"
                    value={settings.dateTimeFormat}
                    onChange={(e) =>
                      handle(() =>
                        client
                          .updateAccountSettings(accountId, {
                            dateTimeFormat: e.target.value as DateTimeFormat,
                          })
                          .then(setSettings),
                      )
                    }
                  >
                    {DATE_TIME_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="tz">
                    {t("admin.account.timezone")}
                  </label>
                  <input
                    id="tz"
                    className="input"
                    defaultValue={settings.timezone}
                    onBlur={(e) =>
                      handle(() =>
                        client
                          .updateAccountSettings(accountId, {
                            timezone: e.target.value,
                          })
                          .then(setSettings),
                      )
                    }
                  />
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <AppFooter />
    </>
  );
}
