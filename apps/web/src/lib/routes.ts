/** Route prefixes that render without the authenticated app chrome. */
export const PUBLIC_PREFIXES = ["/login", "/signup", "/shared"] as const;

/** Whether the given pathname is a public (unauthenticated) route. */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
