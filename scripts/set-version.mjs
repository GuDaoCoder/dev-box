import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const version = process.argv[2];
assert.match(
  version ?? "",
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  "用法：pnpm version:set <MAJOR.MINOR.PATCH>",
);

async function updateJson(path) {
  const document = JSON.parse(await readFile(path, "utf8"));
  document.version = version;
  const filePath = fileURLToPath(path);
  const config = await resolveConfig(filePath);
  await writeFile(path, await format(JSON.stringify(document), { ...config, filepath: filePath }));
}

async function replaceVersion(path, pattern, name) {
  const source = await readFile(path, "utf8");
  assert.match(source, pattern, `未找到 ${name} 版本字段`);
  await writeFile(path, source.replace(pattern, `$1${version}$2`));
}

await Promise.all([
  updateJson(new URL("../package.json", import.meta.url)),
  updateJson(new URL("../apps/desktop/package.json", import.meta.url)),
  updateJson(new URL("../apps/desktop/src-tauri/tauri.conf.json", import.meta.url)),
  replaceVersion(
    new URL("../Cargo.toml", import.meta.url),
    /(\[workspace\.package\][\s\S]*?\nversion\s*=\s*")[^"]+("[^\n]*\n)/,
    "Cargo workspace",
  ),
  replaceVersion(
    new URL("../apps/desktop/src-tauri/Cargo.toml", import.meta.url),
    /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("[^\n]*\n)/,
    "Tauri crate",
  ),
  replaceVersion(
    new URL("../Cargo.lock", import.meta.url),
    /(\[\[package\]\]\nname = "devbox-desktop"\nversion = ")[^"]+("\n)/,
    "Cargo lockfile",
  ),
]);

console.log(`DevBox version updated to ${version}.`);
