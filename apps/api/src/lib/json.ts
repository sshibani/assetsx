/**
 * Defensively parse a stringified JSON object column. Returns null when the
 * value is absent, not valid JSON, or not a plain object (arrays/primitives are
 * rejected). Shared by the mappers/services that persist JSON-as-string.
 */
export function parseJsonObject<T = Record<string, unknown>>(
  value: string | null | undefined,
): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : null;
  } catch {
    return null;
  }
}
