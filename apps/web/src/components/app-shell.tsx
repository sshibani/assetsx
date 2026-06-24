"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/client-context";
import { SideNav } from "./side-nav";

const PUBLIC_PREFIXES = ["/login", "/signup", "/shared"];

/**
 * Wraps every page. On authenticated, non-public routes it renders the left
 * navigation and offsets the page content; on public routes (login, signup,
 * shared bundle links) it renders the children unchanged.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { isAuthenticated } = useAuth();

  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const showChrome = isAuthenticated && !isPublic;

  if (!showChrome) return <>{children}</>;

  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-content">{children}</div>
    </div>
  );
}
