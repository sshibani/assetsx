"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/client-context";
import { isPublicRoute } from "../lib/routes";
import { brandColorForAccount } from "../lib/vault/data";
import { brandAlpha } from "../lib/vault/format";
import { VaultSidebar } from "./vault-sidebar";

/**
 * Wraps every page. On authenticated, non-public routes it renders the Vault
 * left sidebar + main content area, and applies the active tenant's brand
 * accent as CSS custom properties (multi-tenant theming). On public routes
 * (login, signup, shared links) it renders children unchanged.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { isAuthenticated, activeAccount } = useAuth();

  const showChrome = isAuthenticated && !isPublicRoute(pathname);

  if (!showChrome) return <>{children}</>;

  const brand = activeAccount
    ? brandColorForAccount(activeAccount.account.id)
    : "#343ced";

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
