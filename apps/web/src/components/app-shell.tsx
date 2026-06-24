"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/client-context";
import { isPublicRoute } from "../lib/routes";
import { SideNav } from "./side-nav";

/**
 * Wraps every page. On authenticated, non-public routes it renders the left
 * navigation and offsets the page content; on public routes (login, signup,
 * shared bundle links) it renders the children unchanged.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { isAuthenticated } = useAuth();

  const showChrome = isAuthenticated && !isPublicRoute(pathname);

  if (!showChrome) return <>{children}</>;

  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-content">{children}</div>
    </div>
  );
}
