"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/client-context";
import { isPublicRoute } from "../lib/routes";
import { brandColorForAccount } from "../lib/vault/data";
import { brandAlpha } from "../lib/vault/format";
import { VaultSidebar } from "./vault-sidebar";

/**
 * Wraps every page. On authenticated, non-public routes it renders the Vault
 * left sidebar + main content area, and applies the active tenant's brand
 * accent as CSS custom properties (multi-tenant theming). The accent comes
 * from the account's persisted settings (ASS-48), falling back to a stable
 * per-account color until settings load. On public routes it renders children
 * unchanged.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { client, isAuthenticated, activeAccount } = useAuth();
  const accountId = activeAccount?.account.id ?? null;
  const [brand, setBrand] = useState<string>(
    accountId ? brandColorForAccount(accountId) : "#343ced",
  );

  useEffect(() => {
    if (!accountId) return;
    // Optimistic fallback while the request is in flight.
    setBrand(brandColorForAccount(accountId));
    let cancelled = false;
    client
      .getAccountSettings(accountId)
      .then((s) => {
        if (!cancelled && s.brandColor) setBrand(s.brandColor);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, accountId]);

  const showChrome = isAuthenticated && !isPublicRoute(pathname);
  if (!showChrome) return <>{children}</>;

  const brandVars = {
    "--brand": brand,
    "--brand-hover": brand,
    "--brand-tint": brandAlpha(brand, 0.12),
    "--primary": brand,
    "--primary-hover": brand,
    "--primary-soft": brandAlpha(brand, 0.12),
  } as React.CSSProperties;

  return (
    <div className="vault-shell" style={brandVars}>
      <VaultSidebar />
      <div className="vault-main">{children}</div>
    </div>
  );
}
