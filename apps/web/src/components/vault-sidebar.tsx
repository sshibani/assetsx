"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/client-context";
import { isPublicRoute } from "../lib/routes";
import { toStorageUsage } from "../lib/vault/data";
import { initials, type VaultStorageUsage } from "../lib/vault/model";
import { Icon, type IconName } from "./ui/Icon";

interface NavDef {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
  count?: number;
}

export function VaultSidebar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const {
    client,
    isAuthenticated,
    user,
    accounts,
    activeAccount,
    switchAccount,
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState<{ assets: number; bundles: number }>({
    assets: 0,
    bundles: 0,
  });
  const [storage, setStorage] = useState<VaultStorageUsage | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const accountId = activeAccount?.account.id ?? null;

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    Promise.all([client.listAssets(), client.listBundles()])
      .then(([a, b]) => {
        if (!cancelled)
          setCounts({ assets: a.items.length, bundles: b.items.length });
      })
      .catch(() => undefined);
    const loadLogo = () => {
      if (!accountId) return;
      client
        .getAccountSettings(accountId)
        .then((s) => {
          if (!cancelled) setLogoUrl(s.logoUrl);
        })
        .catch(() => undefined);
    };

    if (accountId) {
      client
        .getAccountUsage(accountId)
        .then((u) => {
          if (!cancelled) setStorage(toStorageUsage(u));
        })
        .catch(() => undefined);
      loadLogo();
    }

    // Refresh the logo when branding changes elsewhere.
    const onBranding = () => loadLogo();
    window.addEventListener("assetx:branding-changed", onBranding);

    return () => {
      cancelled = true;
      window.removeEventListener("assetx:branding-changed", onBranding);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accountId]);

  if (isPublicRoute(pathname) || !isAuthenticated) return null;

  const tenantName = activeAccount?.account.name ?? "Workspace";
  const brand = "var(--brand)";

  const nav: NavDef[] = [
    {
      href: "/",
      label: "All assets",
      icon: "grid",
      match: (p) => p === "/" || p.startsWith("/assets"),
      count: counts.assets,
    },
    {
      href: "/bundles",
      label: "Bundles",
      icon: "layers",
      match: (p) => p.startsWith("/bundles"),
      count: counts.bundles,
    },
  ];

  return (
    <aside className="vault-sidebar" aria-label="Primary">
      {/* Tenant switcher */}
      <div className="vault-tenant">
        <button
          type="button"
          className="vault-tenant-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span
            className="vault-tenant-tile"
            style={{
              background: logoUrl ? "var(--surface-2)" : brand,
              overflow: "hidden",
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              initials(tenantName)[0]
            )}
          </span>
          <span className="vault-tenant-meta">
            <span className="vault-tenant-name">{tenantName}</span>
            <span className="vault-tenant-sub">Business · Workspace</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      </div>
      {menuOpen && accounts.length > 0 && (
        <div className="vault-tenant-menu" role="menu">
          {accounts.map((ctx) => (
            <button
              key={ctx.account.id}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                if (ctx.account.id !== activeAccount?.account.id) {
                  void switchAccount(ctx.account.id);
                }
              }}
            >
              <span
                className="vault-tenant-tile"
                style={{ width: 24, height: 24, fontSize: 12, background: brand }}
              >
                {initials(ctx.account.name)[0]}
              </span>
              {ctx.account.name}
            </button>
          ))}
        </div>
      )}

      {/* Upload CTA */}
      <div className="vault-upload-cta">
        <Link href="/upload" className="vault-btn-primary block">
          <Icon name="upload" size={16} />
          Upload assets
        </Link>
      </div>

      {/* Nav */}
      <nav className="vault-nav">
        <div className="vault-nav-label">Library</div>
        {nav.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`vault-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span className="vault-nav-count">{item.count}</span>
              )}
            </Link>
          );
        })}
        <div className="vault-nav-label">Workspace</div>
        <Link
          href="/settings"
          className={`vault-nav-item${
            pathname.startsWith("/settings") ? " active" : ""
          }`}
        >
          <Icon name="settings" size={18} />
          <span>Settings</span>
        </Link>
      </nav>

      {/* Bottom block */}
      <div className="vault-sidebar-bottom">
        <div className="vault-storage">
          <div className="vault-storage-row">
            <span className="label">Storage</span>
            <span className="value">{storage ? storage.label : "—"}</span>
          </div>
          <div className="vault-storage-track">
            <div
              className="vault-storage-fill"
              style={{ width: `${Math.round((storage?.fraction ?? 0) * 100)}%` }}
            />
          </div>
        </div>
        <div className="vault-user">
          <span
            className="vault-avatar"
            style={{ width: 32, height: 32, background: "#ffcfbd", color: "#7a3b22" }}
          >
            {initials(user?.email ?? "U")}
          </span>
          <span className="vault-user-meta">
            <span className="vault-user-name">
              {user?.email?.replace(/@.*/, "") ?? "User"}
            </span>
            <span className="vault-user-role">
              {user?.globalRole === "super_user" ? "Platform admin" : "Member"}
            </span>
          </span>
          <button
            className="vault-icon-btn bare"
            style={{ marginLeft: "auto", width: 32, height: 32 }}
            title="Log out"
            aria-label="Log out"
            onClick={() => {
              router.push("/login");
            }}
          >
            <Icon name="arrow-left" size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
