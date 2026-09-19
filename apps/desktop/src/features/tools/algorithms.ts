export const JSON_INPUT_LIMIT = 2 * 1024 * 1024;

export type JsonTransformResult = {
  output?: string;
  error?: { message: string; line?: number; column?: number };
};

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortJsonValue(nested)]),
    );
  }
  return value;
}

export function transformJson(
  input: string,
  options: { compact: boolean; sortKeys: boolean },
): JsonTransformResult {
  if (new TextEncoder().encode(input).byteLength > JSON_INPUT_LIMIT) {
    return { error: { message: "INPUT_TOO_LARGE" } };
  }
  try {
    const value: unknown = JSON.parse(input);
    return {
      output: JSON.stringify(
        options.sortKeys ? sortJsonValue(value) : value,
        null,
        options.compact ? 0 : 2,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lineColumnMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
    if (lineColumnMatch) {
      return {
        error: {
          message,
          line: Number(lineColumnMatch[1]),
          column: Number(lineColumnMatch[2]),
        },
      };
    }
    const match = /position\s+(\d+)/i.exec(message);
    const unexpectedToken = /Unexpected token ['"](.+?)['"]/i.exec(message);
    const tokenPosition = unexpectedToken ? input.lastIndexOf(unexpectedToken[1] ?? "") : -1;
    const position = match ? Number(match[1]) : tokenPosition >= 0 ? tokenPosition : undefined;
    if (position === undefined) return { error: { message } };
    const before = input.slice(0, position);
    const lines = before.split("\n");
    return {
      error: {
        message,
        line: lines.length,
        column: (lines[lines.length - 1]?.length ?? 0) + 1,
      },
    };
  }
}

export type TimestampResult = { milliseconds: number; seconds: number; iso: string };

export function parseTimestamp(value: string): TimestampResult {
  const input = value.trim();
  if (!input) throw new Error("EMPTY_INPUT");
  let milliseconds: number;
  if (/^-?\d+(?:\.\d+)?$/.test(input)) {
    const numeric = Number(input);
    const integerLength = input.replace(/^-/, "").split(".")[0]?.length ?? 0;
    milliseconds = integerLength <= 10 ? numeric * 1000 : numeric;
  } else {
    milliseconds = Date.parse(input);
  }
  const date = new Date(milliseconds);
  if (!Number.isFinite(milliseconds) || Number.isNaN(date.getTime()))
    throw new Error("INVALID_TIME");
  return {
    milliseconds: Math.trunc(milliseconds),
    seconds: Math.trunc(milliseconds / 1000),
    iso: date.toISOString(),
  };
}

export function formatInTimeZone(milliseconds: number, timeZone?: string, locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(milliseconds));
}

export type EncodingMode = "base64" | "url" | "hex";
export type EncodingDirection = "encode" | "decode";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw new Error("INVALID_BASE64");
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized))
    throw new Error("INVALID_HEX");
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

export function transformEncoding(value: string, mode: EncodingMode, direction: EncodingDirection) {
  if (mode === "url") {
    try {
      return direction === "encode" ? encodeURIComponent(value) : decodeURIComponent(value);
    } catch {
      throw new Error("INVALID_URL");
    }
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    if (mode === "base64")
      return direction === "encode"
        ? bytesToBase64(encoder.encode(value))
        : decoder.decode(base64ToBytes(value));
    return direction === "encode"
      ? bytesToHex(encoder.encode(value))
      : decoder.decode(hexToBytes(value));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVALID_")) throw error;
    const transformed = new Error("INVALID_UTF8") as Error & { cause?: unknown };
    transformed.cause = error;
    throw transformed;
  }
}

export type HashAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";
export type HashEncoding = "hex" | "base64";

export function generateUuids(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("INVALID_COUNT");
  return Array.from({ length: count }, () => crypto.randomUUID());
}

export async function hashText(value: string, algorithm: HashAlgorithm, encoding: HashEncoding) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(algorithm, new TextEncoder().encode(value)),
  );
  if (encoding === "base64") return bytesToBase64(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function textStats(value: string) {
  return {
    characters: Array.from(value).length,
    bytes: new TextEncoder().encode(value).byteLength,
  };
}
