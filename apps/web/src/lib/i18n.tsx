"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, type Locale } from "@assetx/shared-types";
import { useAuth } from "./client-context";

/**
 * Minimal i18n layer. Full message catalogs + string extraction land in
 * ASS-30; for now this persists/reflects the active locale (from the user's
 * preference), keeps <html lang> in sync, and exposes a `t()` that returns the
 * provided English fallback. When catalogs arrive, `t()` will resolve keys.
 */
interface I18nContextValue {
  locale: Locale;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const locale: Locale = user?.locale ?? DEFAULT_LOCALE;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, fallback) => fallback ?? key,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Allow usage outside the provider (e.g. tests) with a safe default.
    return { locale: DEFAULT_LOCALE, t: (key, fallback) => fallback ?? key };
  }
  return ctx;
}
