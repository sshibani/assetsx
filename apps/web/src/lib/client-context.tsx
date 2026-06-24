"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClient } from "./api-client";
import type { AuthAccountContext, Permission, UserDTO } from "./types";

interface AuthContextValue {
  client: ApiClient;
  isAuthenticated: boolean;
  user: UserDTO | null;
  accounts: AuthAccountContext[];
  activeAccount: AuthAccountContext | null;
  permissions: Permission[];
  isSuperUser: boolean;
  hasPermission: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    accountName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "assetx.accessToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new ApiClient({ baseUrl: "" }), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [accounts, setAccounts] = useState<AuthAccountContext[]>([]);
  const [activeAccount, setActiveAccount] = useState<AuthAccountContext | null>(null);

  const applyAuthContext = (
    nextUser: UserDTO | undefined,
    nextAccounts: AuthAccountContext[] | undefined,
    activeAccountId?: string | null,
  ) => {
    setUser(nextUser ?? null);
    const contexts = nextAccounts ?? [];
    setAccounts(contexts);
    setActiveAccount(
      contexts.find((ctx) => ctx.account.id === activeAccountId) ??
        contexts[0] ??
        null,
    );
  };

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      client.setAccessToken(stored);
      setIsAuthenticated(true);
      client
        .me()
        .then((me) =>
          applyAuthContext(me, me.accounts, me.activeAccount),
        )
        .catch(() => logout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const login = async (email: string, password: string) => {
    const tokens = await client.login(email, password);
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    applyAuthContext(
      tokens.user,
      tokens.accounts,
      tokens.activeAccount?.account.id ?? null,
    );
    setIsAuthenticated(true);
  };

  const signup = async (
    accountName: string,
    email: string,
    password: string,
  ) => {
    const tokens = await client.signup(accountName, email, password);
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    applyAuthContext(
      tokens.user,
      tokens.accounts,
      tokens.activeAccount?.account.id ?? null,
    );
    setIsAuthenticated(true);
  };

  const switchAccount = async (accountId: string) => {
    const tokens = await client.switchAccount(accountId);
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    applyAuthContext(tokens.user, tokens.accounts, accountId);
    setIsAuthenticated(true);
  };

  const logout = () => {
    client.setAccessToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setAccounts([]);
    setActiveAccount(null);
    setIsAuthenticated(false);
  };

  const permissions = activeAccount?.permissions ?? [];
  const isSuperUser = user?.globalRole === "super_user";
  const hasPermission = (permission: Permission) =>
    isSuperUser || permissions.includes(permission);

  return (
    <AuthContext.Provider
      value={{
        client,
        isAuthenticated,
        user,
        accounts,
        activeAccount,
        permissions,
        isSuperUser,
        hasPermission,
        login,
        signup,
        switchAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
