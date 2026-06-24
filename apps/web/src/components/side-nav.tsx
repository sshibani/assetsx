"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/client-context";
import { isPublicRoute } from "../lib/routes";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Match the route as a prefix (for detail sub-routes). */
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Asset gallery",
    icon: "▦",
    match: (p) => p === "/" || p.startsWith("/assets"),
  },
  {
    href: "/bundles",
    label: "Bundles",
    icon: "❑",
    match: (p) => p.startsWith("/bundles"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "⚙",
    match: (p) => p.startsWith("/settings"),
  },
];

export function SideNav() {
  const pathname = usePathname() ?? "/";
  const { isAuthenticated, logout } = useAuth();

  if (isPublicRoute(pathname) || !isAuthenticated) return null;

  return (
    <aside className="sidenav" aria-label="Primary">
      <div className="sidenav-brand">
        <span className="brand-mark">A</span>
        <span className="sidenav-brand-name">AssetX</span>
      </div>

      <nav className="sidenav-links">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidenav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="sidenav-icon" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button className="sidenav-logout" onClick={logout}>
        <span className="sidenav-icon" aria-hidden>
          ⏻
        </span>
        <span>Log out</span>
      </button>
    </aside>
  );
}
