import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const [workspacePackage, desktopPackage, tauriConfig, cargoWorkspace, cargoManifest] =
  await Promise.all([
    readJson("package.json"),
    readJson("apps/desktop/package.json"),
    readJson("apps/desktop/src-tauri/tauri.conf.json"),
    readFile(new URL("Cargo.toml", root), "utf8"),
    readFile(new URL("apps/desktop/src-tauri/Cargo.toml", root), "utf8"),
  ]);

const cargoWorkspaceVersion = cargoWorkspace.match(
  /\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
)?.[1];
const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions = new Map([
  ["workspace package", workspacePackage.version],
  ["desktop package", desktopPackage.version],
  ["Tauri config", tauriConfig.version],
  ["Cargo workspace", cargoWorkspaceVersion],
  ["Cargo package", cargoVersion],
]);
const uniqueVersions = new Set(versions.values());

if (uniqueVersions.size !== 1 || uniqueVersions.has(undefined)) {
  for (const [source, version] of versions) {
    console.error(`${source}: ${version ?? "missing"}`);
  }
  process.exitCode = 1;
} else {
  console.log(`DevBox version ${uniqueVersions.values().next().value} is synchronized.`);
}
