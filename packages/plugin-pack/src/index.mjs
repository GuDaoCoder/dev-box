import {
  createHash,
  createPublicKey,
  sign as signPayload,
  verify as verifySignature,
} from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const packagePolicy = Object.freeze({
  maxArchiveBytes: 25 * 1024 * 1024,
  maxExpandedBytes: 50 * 1024 * 1024,
  maxFileBytes: 8 * 1024 * 1024,
  maxFiles: 512,
  maxCompressionRatio: 100,
});

const allowedPermissions = new Set([
  "clipboard:read",
  "clipboard:write",
  "java:execute",
  "storage:read",
  "storage:write",
]);
const allowedIcons = new Set(["binary", "box", "braces", "clock", "code", "fingerprint", "plug"]);
const allowedTopLevelFields = new Set([
  "schemaVersion",
  "id",
  "name",
  "description",
  "version",
  "publisher",
  "engines",
  "type",
  "entry",
  "activationEvents",
  "permissions",
  "locales",
  "contributes",
]);

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} 必须是对象`);
  }
}

function assertExactKeys(value, name, allowed, required = []) {
  assertPlainObject(value, name);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !(key in value));
  if (unknown.length || missing.length) {
    throw new Error(
      `${name} 字段无效${unknown.length ? `，未知：${unknown.join(", ")}` : ""}${missing.length ? `，缺少：${missing.join(", ")}` : ""}`,
    );
  }
}

export function isSafePackagePath(value) {
  if (!value || value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
    return false;
  }
  const parts = value.split("/");
  return parts.every((part) => part && part !== "." && part !== "..");
}

export function validateManifest(manifest) {
  assertPlainObject(manifest, "plugin.json");
  const unknown = Object.keys(manifest).filter((key) => !allowedTopLevelFields.has(key));
  if (unknown.length) {
    throw new Error(`plugin.json 包含未知字段：${unknown.join(", ")}`);
  }
  if (manifest.schemaVersion !== 1) throw new Error("schemaVersion 必须为 1");
  if (!/^devbox\.[a-z0-9.-]{1,93}$/.test(manifest.id ?? "")) throw new Error("插件 ID 无效");
  if (typeof manifest.name !== "string" || !manifest.name.trim() || manifest.name.length > 80) {
    throw new Error("插件名称无效");
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? "")) {
    throw new Error("插件版本必须是 SemVer");
  }
  assertExactKeys(manifest.publisher, "publisher", ["id", "name", "keyId"], ["id", "name"]);
  if (!/^[a-z0-9][a-z0-9.-]{1,63}$/.test(manifest.publisher.id ?? "")) {
    throw new Error("发布者 ID 无效");
  }
  if (
    typeof manifest.publisher.name !== "string" ||
    !manifest.publisher.name.trim() ||
    manifest.publisher.name.length > 80
  ) {
    throw new Error("发布者名称无效");
  }
  if (
    manifest.publisher.keyId !== undefined &&
    !/^[a-f0-9]{16,64}$/.test(manifest.publisher.keyId)
  ) {
    throw new Error("发布者 keyId 无效");
  }
  assertExactKeys(manifest.engines, "engines", ["devbox", "pluginApi"], ["devbox", "pluginApi"]);
  if (!manifest.engines.devbox || !manifest.engines.pluginApi) throw new Error("缺少兼容版本声明");
  if (!["ui", "native"].includes(manifest.type)) throw new Error("插件类型无效");
  assertExactKeys(manifest.entry, "entry", ["main"], ["main"]);
  if (!isSafePackagePath(manifest.entry.main) || !manifest.entry.main.endsWith(".html")) {
    throw new Error("插件入口路径无效");
  }
  if (!Array.isArray(manifest.activationEvents) || manifest.activationEvents.length > 32) {
    throw new Error("activationEvents 无效");
  }
  if (
    !Array.isArray(manifest.permissions) ||
    manifest.permissions.some((permission) => !allowedPermissions.has(permission)) ||
    new Set(manifest.permissions).size !== manifest.permissions.length
  ) {
    throw new Error("插件权限声明无效");
  }
  assertPlainObject(manifest.locales, "locales");
  for (const [locale, localePath] of Object.entries(manifest.locales)) {
    if (!["zh-CN", "en-US"].includes(locale) || !isSafePackagePath(localePath)) {
      throw new Error("插件语言资源无效");
    }
  }
  assertPlainObject(manifest.contributes, "contributes");
  assertExactKeys(manifest.contributes, "contributes", ["views", "commands"], ["views"]);
  if (!Array.isArray(manifest.contributes.views)) throw new Error("插件缺少视图声明");
  for (const view of manifest.contributes.views) {
    assertExactKeys(
      view,
      "view",
      ["id", "titleKey", "icon", "order", "category"],
      ["id", "titleKey", "icon", "order", "category"],
    );
    assertExactKeys(
      view.category,
      "view.category",
      ["id", "title", "order"],
      ["id", "title", "order"],
    );
    assertExactKeys(
      view.category.title,
      "view.category.title",
      ["zh-CN", "en-US"],
      ["zh-CN", "en-US"],
    );
    const validOrder = (value) => Number.isInteger(value) && value >= 0 && value <= 10_000;
    const validTitle = (value) =>
      typeof value === "string" && Boolean(value.trim()) && value.length <= 80;
    if (
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(view.id ?? "") ||
      typeof view.titleKey !== "string" ||
      view.titleKey.length < 3 ||
      !allowedIcons.has(view.icon) ||
      !validOrder(view.order) ||
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(view.category.id ?? "") ||
      !validOrder(view.category.order) ||
      !validTitle(view.category.title["zh-CN"]) ||
      !validTitle(view.category.title["en-US"])
    ) {
      throw new Error("插件视图声明无效");
    }
  }
  for (const command of manifest.contributes.commands ?? []) {
    assertExactKeys(command, "command", ["id", "titleKey"], ["id", "titleKey"]);
  }
  return manifest;
}

async function collectFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (["checksums.json", "signature.json"].includes(next)) continue;
    const info = await lstat(path.join(root, next));
    if (info.isSymbolicLink()) throw new Error(`插件包不允许符号链接：${next}`);
    if (info.isDirectory()) files.push(...(await collectFiles(root, next)));
    else if (info.isFile()) files.push(next);
  }
  return files;
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    localParts.push(local, name, entry.data);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function readZip(archive) {
  if (archive.length > packagePolicy.maxArchiveBytes) throw new Error("插件包超过大小限制");
  const minimum = Math.max(0, archive.length - 65_557);
  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("插件包不是有效 ZIP 文件");
  const count = archive.readUInt16LE(endOffset + 10);
  if (count > packagePolicy.maxFiles) throw new Error("插件包文件数量超过限制");
  let cursor = archive.readUInt32LE(endOffset + 16);
  const entries = new Map();
  let expanded = 0;
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
    const compression = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (compression !== 0) throw new Error("当前打包器只接受 STORE 压缩方法");
    if (!isSafePackagePath(name) || entries.has(name)) throw new Error(`插件包路径无效：${name}`);
    if (size > packagePolicy.maxFileBytes) throw new Error(`插件文件超过大小限制：${name}`);
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP 本地文件头损坏");
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(dataOffset, dataOffset + compressedSize);
    if (data.length !== size) throw new Error(`插件文件长度无效：${name}`);
    entries.set(name, Buffer.from(data));
    expanded += size;
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (expanded > packagePolicy.maxExpandedBytes) throw new Error("插件包展开大小超过限制");
  return entries;
}

export async function packPlugin({ source, output, privateKey, keyId }) {
  const filePaths = await collectFiles(source);
  if (!filePaths.includes("plugin.json")) throw new Error("插件目录缺少 plugin.json");
  if (filePaths.length > packagePolicy.maxFiles - 2) throw new Error("插件文件数量超过限制");
  const entries = [];
  let expanded = 0;
  for (const filePath of filePaths) {
    if (!isSafePackagePath(filePath)) throw new Error(`插件路径无效：${filePath}`);
    const data = await readFile(path.join(source, filePath));
    if (data.length > packagePolicy.maxFileBytes)
      throw new Error(`插件文件超过大小限制：${filePath}`);
    expanded += data.length;
    entries.push({ path: filePath, data });
  }
  if (expanded > packagePolicy.maxExpandedBytes) throw new Error("插件目录超过展开大小限制");
  const manifest = validateManifest(
    JSON.parse(entries.find((entry) => entry.path === "plugin.json").data),
  );
  if (manifest.type !== "ui") throw new Error("运行时安装包只允许 ui 插件");
  if (!entries.some((entry) => entry.path === manifest.entry.main))
    throw new Error("插件入口文件不存在");
  for (const localePath of Object.values(manifest.locales)) {
    if (!entries.some((entry) => entry.path === localePath)) {
      throw new Error(`插件语言资源不存在：${localePath}`);
    }
  }
  if (!manifest.publisher.keyId || manifest.publisher.keyId !== keyId) {
    throw new Error("签名 keyId 与 manifest 不一致");
  }

  const checksums = Buffer.from(
    `${JSON.stringify({
      algorithm: "SHA-256",
      files: entries.map((entry) => ({
        path: entry.path,
        sha256: sha256(entry.data),
        size: entry.data.length,
      })),
    })}\n`,
  );
  const signature = signPayload(null, checksums, privateKey).toString("base64");
  const signatureFile = Buffer.from(
    `${JSON.stringify({ algorithm: "Ed25519", keyId, signature })}\n`,
  );
  const archive = createZip([
    ...entries,
    { path: "checksums.json", data: checksums },
    { path: "signature.json", data: signatureFile },
  ]);
  if (archive.length > packagePolicy.maxArchiveBytes) throw new Error("插件包超过归档大小限制");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, archive);
  return { manifest, archiveSha256: sha256(archive), size: archive.length };
}

export async function verifyPluginArchive({ archive, publicKey }) {
  const data = Buffer.isBuffer(archive) ? archive : await readFile(archive);
  const entries = readZip(data);
  for (const required of ["plugin.json", "checksums.json", "signature.json"]) {
    if (!entries.has(required)) throw new Error(`插件包缺少 ${required}`);
  }
  const manifest = validateManifest(JSON.parse(entries.get("plugin.json")));
  const checksumBytes = entries.get("checksums.json");
  const checksums = JSON.parse(checksumBytes);
  const signature = JSON.parse(entries.get("signature.json"));
  if (checksums.algorithm !== "SHA-256" || signature.algorithm !== "Ed25519") {
    throw new Error("插件包算法不受支持");
  }
  if (signature.keyId !== manifest.publisher.keyId) throw new Error("签名发布者不匹配");
  const expectedPaths = new Set(["checksums.json", "signature.json"]);
  for (const item of checksums.files ?? []) {
    if (!isSafePackagePath(item.path) || expectedPaths.has(item.path))
      throw new Error("checksum 路径无效");
    const file = entries.get(item.path);
    if (!file || file.length !== item.size || sha256(file) !== item.sha256) {
      throw new Error(`插件文件校验失败：${item.path}`);
    }
    expectedPaths.add(item.path);
  }
  if (expectedPaths.size !== entries.size) throw new Error("插件包包含未签名文件");
  const verificationKey = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  if (
    !verifySignature(
      null,
      checksumBytes,
      verificationKey,
      Buffer.from(signature.signature, "base64"),
    )
  ) {
    throw new Error("插件签名无效");
  }
  if (!entries.has(manifest.entry.main)) throw new Error("插件入口文件不存在");
  return { manifest, archiveSha256: sha256(data), size: data.length };
}
