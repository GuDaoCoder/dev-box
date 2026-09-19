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
  | "PLUGIN_PACKAGE_INVALID"
  | "PLUGIN_INCOMPATIBLE"
  | "NETWORK_ERROR"
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

export type PluginPermission =
  "clipboard:read" | "clipboard:write" | "java:execute" | "storage:read" | "storage:write";

export interface JavaExecutionRequest {
  source: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface JavaExecutionResult {
  status: "success" | "error" | "timeout";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
}

export interface RuntimePluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  publisher: {
    id: string;
    name: string;
    keyId?: string;
  };
  engines: {
    devbox: string;
    pluginApi: string;
  };
  type: "ui";
  entry: {
    main: string;
  };
  activationEvents: string[];
  permissions: PluginPermission[];
  locales: Partial<Record<"zh-CN" | "en-US", string>>;
  contributes: {
    views: Array<{
      id: string;
      titleKey: string;
      icon: string;
      order: number;
      category: {
        id: string;
        title: Record<"zh-CN" | "en-US", string>;
        order: number;
      };
    }>;
    commands?: Array<{
      id: string;
      titleKey: string;
    }>;
  };
}

export interface InstalledPlugin {
  id: string;
  name: string;
  publisherId: string;
  currentVersion: string;
  previousVersion?: string;
  enabled: boolean;
  status: "installed" | "disabled" | "failed";
  source: "offline" | "development";
  manifest: RuntimePluginManifest;
  grantedPermissions: PluginPermission[];
  signatureStatus: "verified" | "unsigned" | "unsigned-development";
}

export interface PackageSummary {
  manifest: RuntimePluginManifest;
  archiveSha256: string;
  signatureStatus: "verified" | "unsigned" | "unsigned-development";
  expandedSize: number;
}

export interface InstallPreflight {
  token: string;
  summary: PackageSummary;
  source: "offline" | "development";
  sourceReference?: string;
  change: "install" | "update" | "reinstall";
}

export interface InstalledPluginsResponse {
  plugins: InstalledPlugin[];
}

export interface PluginGrant {
  permission: PluginPermission;
  granted: boolean;
  revision: number;
}

export interface PluginGrantsResponse {
  grants: PluginGrant[];
}

export interface PreflightResponse {
  preflight: InstallPreflight;
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
