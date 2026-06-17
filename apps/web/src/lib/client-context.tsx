"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClient } from "./api-client.js";

interface AuthContextValue {
  client: ApiClient;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "assetx.accessToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new ApiClient({ baseUrl: "" }), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      client.setAccessToken(stored);
      setIsAuthenticated(true);
    }
  }, [client]);

  const login = async (email: string, password: string) => {
    const tokens = await client.login(email, password);
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    client.setAccessToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ client, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
