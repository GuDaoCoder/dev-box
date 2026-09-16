import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const pluginsDirectory = path.join(root, "plugins");
const target = path.join(root, "apps/desktop/src/plugins.generated.ts");
const pluginFolders = (await readdir(pluginsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const plugins = [];
const identifiers = new Set();
for (const folder of pluginFolders) {
  const directory = path.join(pluginsDirectory, folder);
  const manifest = JSON.parse(await readFile(path.join(directory, "plugin.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || !/^devbox\.[a-z0-9.-]+$/.test(manifest.id)) {
    throw new Error(`插件 ${folder} 的 manifest 无效`);
  }
  if (identifiers.has(manifest.id)) {
    throw new Error(`插件 ID 重复：${manifest.id}`);
  }
  if (!Array.isArray(manifest.contributes?.views)) {
    throw new Error(`插件 ${manifest.id} 缺少 views 声明`);
  }
  identifiers.add(manifest.id);
  plugins.push({
    packageName: packageJson.name,
    exportName: `${folder.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}Plugin`,
  });
}

const output = `${plugins
  .map(({ exportName, packageName }) => `import { ${exportName} } from "${packageName}";`)
  .join("\n")}
import type { DevBoxPlugin } from "@devbox/plugin-sdk";

export const builtInPlugins: readonly DevBoxPlugin[] = [${plugins
  .map(({ exportName }) => exportName)
  .join(", ")}];
`;

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8");
  if (current !== output) {
    throw new Error("内置插件注册表不是最新版本，请运行 pnpm plugins:generate");
  }
} else {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(target, output);
}
