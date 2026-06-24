"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/client-context";

export default function SettingsPage() {
  const {
    isAuthenticated,
    user,
    accounts,
    activeAccount,
    switchAccount,
    isSuperUser,
    hasPermission,
    logout,
  } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const canAdminAccount =
    hasPermission("members:manage") || hasPermission("account:update");

  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("assetx.accessToken")) {
        router.push("/login");
        return;
      }
      setReady(true);
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!ready) {
    return (
      <div className="center-state">
        <div className="spinner" />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      <header className="appbar">
        <div className="brand">Settings</div>
      </header>

      <main className="container">
        <div className="detail-grid">
          <div>
            <div className="panel">
              <h3 className="section-title">Account</h3>
              <div className="field">
                <label className="label">Signed in as</label>
                <div className="readonly-value" aria-readonly="true">
                  {user?.email ?? "—"}
                </div>
              </div>
              {accounts.length > 0 && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Active account</label>
                  <select
                    className="input"
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
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="panel">
              <h3 className="section-title">Administration</h3>
              {!canAdminAccount && !isSuperUser ? (
                <p className="dim" style={{ color: "var(--text-muted)" }}>
                  You have no administrative settings.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {canAdminAccount && (
                    <Link className="btn secondary block" href="/admin/account">
                      Account administration
                    </Link>
                  )}
                  {isSuperUser && (
                    <Link className="btn secondary block" href="/admin/platform">
                      Platform administration
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="panel" style={{ marginTop: 20 }}>
              <h3 className="section-title">Session</h3>
              <button className="btn danger block" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
