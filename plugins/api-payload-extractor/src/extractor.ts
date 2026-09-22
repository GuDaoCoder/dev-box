export type PayloadFormat = "json" | "xml" | "text";
export type ExtractionErrorCode = "EMPTY_INPUT" | "INVALID_LOG" | "BODY_MISSING";

export interface ExtractionResult {
  output: string;
  format: PayloadFormat;
}

export class ExtractionError extends Error {
  constructor(readonly code: ExtractionErrorCode) {
    super(code);
    this.name = "ExtractionError";
  }
}

function decodeJavaEscapes(value: string) {
  return value.replace(
    /\\u([0-9a-fA-F]{4})|\\([btnfr"'\\])/g,
    (_match: string, unicode: string | undefined, escape: string | undefined) => {
      if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
      const replacements: Record<string, string> = {
        b: "\b",
        t: "\t",
        n: "\n",
        f: "\f",
        r: "\r",
        '"': '"',
        "'": "'",
        "\\": "\\",
      };
      return escape ? (replacements[escape] ?? escape) : "";
    },
  );
}

function normalizeEscapedText(value: string) {
  let normalized = value.trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(normalized);
      if (typeof parsed === "string") return parsed.trim();
    } catch {
      normalized = normalized.slice(1, -1);
    }
  }
  return decodeJavaEscapes(normalized).trim();
}

function findJsonCandidate(value: string) {
  for (let start = 0; start < value.length; start += 1) {
    const opening = value[start];
    if (opening !== "{" && opening !== "[") continue;
    const stack: string[] = [];
    let quoted = false;
    let escaped = false;
    for (let index = start; index < value.length; index += 1) {
      const character = value[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') {
        quoted = true;
        continue;
      }
      if (character === "{" || character === "[") stack.push(character);
      if (character === "}" || character === "]") {
        const expected = character === "}" ? "{" : "[";
        if (stack.pop() !== expected) break;
        if (stack.length === 0) return value.slice(start, index + 1);
      }
    }
  }
  return undefined;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseLog(value: string, depth = 0): unknown {
  const original = value.trim();
  const parsedOriginal = tryParseJson(original);
  if (parsedOriginal !== undefined) {
    if (typeof parsedOriginal === "string" && depth < 2) return parseLog(parsedOriginal, depth + 1);
    return parsedOriginal;
  }

  const originalCandidate = findJsonCandidate(original);
  if (originalCandidate) {
    const parsedCandidate = tryParseJson(originalCandidate);
    if (parsedCandidate !== undefined) return parsedCandidate;
  }

  const normalized = normalizeEscapedText(original);
  const parsedNormalized = tryParseJson(normalized);
  if (parsedNormalized !== undefined) {
    if (typeof parsedNormalized === "string" && depth < 2)
      return parseLog(parsedNormalized, depth + 1);
    return parsedNormalized;
  }

  const normalizedCandidate = findJsonCandidate(normalized);
  const parsedCandidate = normalizedCandidate ? tryParseJson(normalizedCandidate) : undefined;
  if (parsedCandidate !== undefined) return parsedCandidate;
  throw new ExtractionError("INVALID_LOG");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBody(log: unknown) {
  if (!isRecord(log)) throw new ExtractionError("BODY_MISSING");
  const isEnvelope =
    Object.hasOwn(log, "request") &&
    (Object.hasOwn(log, "response") || Object.hasOwn(log, "reponse"));
  const request = isEnvelope ? log.request : log;
  if (!isRecord(request) || !Object.hasOwn(request, "body") || request.body == null) {
    throw new ExtractionError("BODY_MISSING");
  }
  return request.body;
}

function tokenizeXml(value: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < value.length) {
    if (value[index] !== "<") {
      const end = value.indexOf("<", index);
      tokens.push(value.slice(index, end < 0 ? value.length : end));
      index = end < 0 ? value.length : end;
      continue;
    }
    const specialEnd = value.startsWith("<!--", index)
      ? "-->"
      : value.startsWith("<![CDATA[", index)
        ? "]]>"
        : value.startsWith("<?", index)
          ? "?>"
          : undefined;
    if (specialEnd) {
      const end = value.indexOf(specialEnd, index + 2);
      if (end < 0) return undefined;
      tokens.push(value.slice(index, end + specialEnd.length));
      index = end + specialEnd.length;
      continue;
    }
    let quoted: string | undefined;
    let end = index + 1;
    for (; end < value.length; end += 1) {
      const character = value[end];
      if (quoted) {
        if (character === quoted) quoted = undefined;
      } else if (character === '"' || character === "'") quoted = character;
      else if (character === ">") break;
    }
    if (end >= value.length) return undefined;
    tokens.push(value.slice(index, end + 1));
    index = end + 1;
  }
  return tokens;
}

function formatXml(value: string) {
  const normalized = value.trim();
  if (!normalized.startsWith("<")) return undefined;
  const tokens = tokenizeXml(normalized);
  if (!tokens) return undefined;
  const lines: string[] = [];
  const stack: string[] = [];
  let rootCount = 0;
  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;
    if (!token.startsWith("<")) {
      if (stack.length === 0 && token) return undefined;
      lines.push(`${"  ".repeat(stack.length)}${token}`);
      continue;
    }
    if (
      token.startsWith("<?") ||
      token.startsWith("<!--") ||
      token.startsWith("<![CDATA[") ||
      token.startsWith("<!DOCTYPE")
    ) {
      lines.push(`${"  ".repeat(stack.length)}${token}`);
      continue;
    }
    const closing = token.match(/^<\/\s*([A-Za-z_][\w:.-]*)\s*>$/);
    if (closing) {
      if (stack.pop() !== closing[1]) return undefined;
      lines.push(`${"  ".repeat(stack.length)}${token}`);
      continue;
    }
    const opening = token.match(/^<\s*([A-Za-z_][\w:.-]*)\b/);
    if (!opening) return undefined;
    if (stack.length === 0) rootCount += 1;
    lines.push(`${"  ".repeat(stack.length)}${token}`);
    if (!/\/\s*>$/.test(token)) stack.push(opening[1]!);
  }
  if (stack.length > 0 || rootCount !== 1) return undefined;
  return lines.join("\n");
}

function formatBody(body: unknown): ExtractionResult {
  if (typeof body !== "string") {
    return { output: JSON.stringify(body, null, 2), format: "json" };
  }
  const normalized = normalizeEscapedText(body);
  try {
    return { output: JSON.stringify(JSON.parse(normalized), null, 2), format: "json" };
  } catch {
    const xml = formatXml(normalized);
    return xml ? { output: xml, format: "xml" } : { output: normalized, format: "text" };
  }
}

export function extractApiPayload(input: string): ExtractionResult {
  if (!input.trim()) throw new ExtractionError("EMPTY_INPUT");
  return formatBody(readBody(parseLog(input)));
}
