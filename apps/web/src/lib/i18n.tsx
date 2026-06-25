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
import { en, type MessageKey } from "../i18n/en";
import { nl } from "../i18n/nl";

const CATALOGS: Record<Locale, Record<string, string>> = { en, nl };

export type TParams = Record<string, string | number>;

/**
 * The base key for a pluralized message (e.g. "bundle.assetsCount" from
 * "bundle.assetsCount.one"). Callers pass the base key + a `count` param.
 */
type PluralBaseKey<K extends string> = K extends `${infer Base}.one`
  ? Base
  : K extends `${infer Base}.other`
    ? Base
    : never;

/** All keys callers may pass to t(): every catalog key + plural base keys. */
export type TKey = MessageKey | PluralBaseKey<MessageKey>;

/** Interpolate `{token}` placeholders in a message string. */
function interpolate(message: string, params?: TParams): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

/**
 * Resolve a message for a locale. Supports pluralization via `key.one` /
 * `key.other` when a numeric `count` param is present. Falls back to the
 * English catalog, then to the key itself, so missing translations never crash.
 */
export function translate(
  locale: Locale,
  key: TKey,
  params?: TParams,
): string {
  const catalog = CATALOGS[locale] ?? en;
  let lookupKey: string = key;

  if (params && typeof params.count === "number") {
    const plural = params.count === 1 ? `${key}.one` : `${key}.other`;
    if (plural in catalog || plural in en) lookupKey = plural;
  }

  const message = catalog[lookupKey] ?? en[lookupKey as MessageKey] ?? key;
  return interpolate(message, params);
}

interface I18nContextValue {
  locale: Locale;
  t: (key: TKey, params?: TParams) => string;
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
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      t: (key, params) => translate(DEFAULT_LOCALE, key, params),
    };
  }
  return ctx;
}
