import type {
  AccountRole,
  GlobalRole,
  Permission,
} from "@assetx/shared-types";
import { permissionsForAccountRole } from "@assetx/shared-types";

export interface AuthUser {
  id: string;
  globalRole: GlobalRole;
  accountId: string | null;
  accountRole: AccountRole | null;
  permissions: Permission[];
  identityProvider: string;
  sessionId?: string;
}

export function isSuperUser(user: AuthUser): boolean {
  return user.globalRole === "super_user";
}

export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return isSuperUser(user) || user.permissions.includes(permission);
}

export function requirePermission(
  user: AuthUser,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function permissionsForRole(role: AccountRole | null): Permission[] {
  return role ? permissionsForAccountRole(role) : [];
}
