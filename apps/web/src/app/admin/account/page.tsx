"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/client-context";
import { ApiError } from "../../../lib/api-client";
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
  const accountId = activeAccount?.account.id ?? null;

  const canManageMembers = hasPermission("members:manage");
  const canManageAdmins = hasPermission("members:manage_admins");
  const canUpdate = hasPermission("account:update");

  const [members, setMembers] = useState<AccountMembershipDTO[]>([]);
  const [settings, setSettings] = useState<AccountSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AccountRole>("asset_viewer");

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
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      load();
    }, 50);
    return () => clearTimeout(t);
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
      setNewRole("asset_viewer");
    });
  };

  if (!accountId) {
    return (
      <main className="container">
        <p>No active account.</p>
      </main>
    );
  }

  if (!canManageMembers && !canUpdate) {
    return (
      <main className="container">
        <h2>Account administration</h2>
        <p>You do not have permission to administer this account.</p>
        <Link href="/">Back to gallery</Link>
      </main>
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
          AssetX · Account admin
        </div>
        <div className="appbar-actions">
          <Link className="btn secondary" href="/">
            Back to gallery
          </Link>
        </div>
      </header>

      <main className="container">
        <h2>{activeAccount?.account.name} — Administration</h2>
        {error && <div className="error-text">{error}</div>}
        {loading ? (
          <div className="center-state">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <section style={{ marginTop: 24 }}>
              <h3>Members</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    {canManageMembers && <th>Actions</th>}
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
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            m.role
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${m.status === "active" ? "ready" : "failed"}`}
                          >
                            {m.status}
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
                                  {m.status === "active" ? "Disable" : "Enable"}
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
                                  Remove
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
                    {roleOptions("asset_viewer").map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button className="btn" type="submit">
                    Add member
                  </button>
                </form>
              )}
            </section>

            {canUpdate && settings && (
              <section style={{ marginTop: 32 }}>
                <h3>Settings</h3>
                <div className="field">
                  <label className="label" htmlFor="dtf">
                    Date/time format
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
                    Timezone (IANA)
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
    </>
  );
}
