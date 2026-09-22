import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { packUnsignedPlugin } from "../packages/plugin-pack/src/index.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.resolve(process.cwd(), process.argv[2] ?? ".");
const manifest = JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8"));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "devbox-plugin-package-"));
const staging = path.join(temporaryRoot, "staging");
const outputDirectory = path.join(workspaceRoot, "release");
const output = path.join(outputDirectory, `${manifest.id}-${manifest.version}.zip`);

try {
  await mkdir(staging, { recursive: true });
  await cp(path.join(pluginRoot, "plugin.json"), path.join(staging, "plugin.json"));
  await cp(path.join(pluginRoot, "dist"), path.join(staging, "dist"), { recursive: true });
  if (Object.keys(manifest.locales ?? {}).length > 0) {
    await cp(path.join(pluginRoot, "locales"), path.join(staging, "locales"), { recursive: true });
  }
  await mkdir(outputDirectory, { recursive: true });

  const result = await packUnsignedPlugin({ source: staging, output });
  const archive = await readFile(output);
  const sha256 = createHash("sha256").update(archive).digest("hex");
  process.stdout.write(`${result.manifest.id}@${result.manifest.version} → ${output}\n`);
  process.stdout.write(`SHA-256 ${sha256}\n`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
