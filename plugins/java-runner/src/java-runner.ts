import type {
  InstalledPluginBridge,
  InstalledPluginHostContext,
  JavaExecutionRequest,
  JavaExecutionResult,
} from "@devbox/plugin-sdk";

export const MAX_SNIPPET_BYTES = 64 * 1024;
export const DEFAULT_TIMEOUT_MS = 5_000;
export const MAX_OUTPUT_BYTES = 256 * 1024;

export type { JavaExecutionResult };

type JavaBridgeTarget = {
  readonly __DEVBOX_PLUGIN_API__?: Pick<InstalledPluginBridge, "java"> &
    Partial<Pick<InstalledPluginBridge, "reportReady">>;
};

type JavaContextTarget = {
  readonly __DEVBOX_PLUGIN__?: Pick<InstalledPluginHostContext, "java">;
};

export function createExecutionRequest(source: string): JavaExecutionRequest {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new Error("EMPTY_SNIPPET");
  if (new TextEncoder().encode(normalized).byteLength > MAX_SNIPPET_BYTES) {
    throw new Error("SNIPPET_TOO_LARGE");
  }
  return {
    source: normalized,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  };
}

export function getJavaRunnerAPI(target: JavaBridgeTarget = window) {
  return target.__DEVBOX_PLUGIN_API__?.java;
}

export function getJavaEnvironment(target: JavaContextTarget = window) {
  return target.__DEVBOX_PLUGIN__?.java;
}

export function formatHostError(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || error === null) return String(error);
  const candidate = error as {
    message?: unknown;
    details?: { reason?: unknown };
  };
  if (typeof candidate.details?.reason === "string") return candidate.details.reason;
  if (typeof candidate.message === "string") return candidate.message;
  return undefined;
}

export async function reportPluginReady() {
  await window.__DEVBOX_PLUGIN_API__?.reportReady?.();
}
