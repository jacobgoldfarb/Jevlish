import type { EntryType } from "@typesafe-ai/sdk";

/**
 * Normalize an application value into what the API accepts as state or as a
 * description: text, a JSON object/array, or null. Dates become ISO strings via
 * toJSON; functions and undefined are dropped, as JSON.stringify would.
 */
export function toState(value: unknown): EntryType {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return null;
  const parsed: unknown = JSON.parse(encoded);
  if (parsed === null || typeof parsed === "string") return parsed;
  if (typeof parsed === "object") return parsed as EntryType;
  return String(parsed);
}

/** Deterministic serialization with sorted object keys, used for cache and dedupe keys. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",");
  return `{${body}}`;
}
