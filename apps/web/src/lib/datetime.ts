import type { AccountSettingsDTO, DateTimeFormat } from "./types";

export interface DateTimeFormatOptions {
  dateTimeFormat: DateTimeFormat;
  timezone: string;
}

const DEFAULTS: DateTimeFormatOptions = {
  dateTimeFormat: "ISO",
  timezone: "UTC",
};

function intlOptions(
  format: DateTimeFormat,
  timezone: string,
): Intl.DateTimeFormatOptions {
  const base: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (format === "US") return { ...base, hour12: true };
  return { ...base, hour12: false };
}

/**
 * Format an ISO date string according to an account's settings.
 * - ISO: machine-friendly ISO-ish output in the configured timezone.
 * - US:  en-US locale, 12-hour clock.
 * - EU:  en-GB locale, 24-hour clock, day-first.
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  options: Partial<DateTimeFormatOptions> = {},
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const opts = { ...DEFAULTS, ...options };

  if (opts.dateTimeFormat === "ISO") {
    // Render the wall-clock time in the configured timezone, ISO-like.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: opts.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  }

  const locale = opts.dateTimeFormat === "US" ? "en-US" : "en-GB";
  return new Intl.DateTimeFormat(
    locale,
    intlOptions(opts.dateTimeFormat, opts.timezone),
  ).format(date);
}

export function formatterForSettings(
  settings: AccountSettingsDTO | null | undefined,
): (value: string | Date | null | undefined) => string {
  const options: Partial<DateTimeFormatOptions> = settings
    ? { dateTimeFormat: settings.dateTimeFormat, timezone: settings.timezone }
    : {};
  return (value) => formatDateTime(value, options);
}
