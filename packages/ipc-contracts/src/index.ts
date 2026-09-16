export const API_VERSION = 1 as const;

export const CORE_PLUGIN_ID = "devbox.core";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface CommandEnvelope<T> {
  apiVersion: typeof API_VERSION;
  pluginId: string;
  requestId: string;
  payload: T;
}

export type DevBoxErrorCode =
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STORAGE_ERROR"
  | "INTERNAL";

export interface DevBoxError {
  code: DevBoxErrorCode;
  messageKey: string;
  details?: Record<string, JsonValue>;
  correlationId: string;
  retryable: boolean;
}

export interface CorePingRequest {
  clientTime: string;
}

export interface CorePingResponse {
  application: "DevBox";
  version: string;
  ready: boolean;
  serverTime: string;
}

export interface SettingRecord {
  key: string;
  value: JsonValue;
  revision: number;
}

export interface SettingsGetRequest {
  key: string;
}

export interface SettingsGetResponse {
  record?: SettingRecord;
}

export interface SettingsUpdateRequest {
  key: string;
  value: JsonValue;
  expectedRevision?: number;
}

export interface SettingsUpdateResponse {
  record: SettingRecord;
}

export function createEnvelope<T>(pluginId: string, payload: T): CommandEnvelope<T> {
  return {
    apiVersion: API_VERSION,
    pluginId,
    requestId: crypto.randomUUID(),
    payload,
  };
}

export function isDevBoxError(value: unknown): value is DevBoxError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DevBoxError>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.messageKey === "string" &&
    typeof candidate.correlationId === "string" &&
    typeof candidate.retryable === "boolean"
  );
}
