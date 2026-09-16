import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const current = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenKeys(child, current)
      : [current];
  });
}

async function comparePair(englishPath, chinesePath) {
  const [english, chinese] = await Promise.all(
    [englishPath, chinesePath].map(async (file) => JSON.parse(await readFile(file, "utf8"))),
  );
  const englishKeys = flattenKeys(english).sort();
  const chineseKeys = flattenKeys(chinese).sort();
  if (JSON.stringify(englishKeys) !== JSON.stringify(chineseKeys)) {
    throw new Error(`翻译键不一致：${englishPath} 与 ${chinesePath}`);
  }
}

const root = process.cwd();
const applicationLocales = path.join(root, "apps/desktop/src/i18n/locales");
const namespaces = await readdir(path.join(applicationLocales, "en-US"));
for (const namespace of namespaces.filter((file) => file.endsWith(".json"))) {
  await comparePair(
    path.join(applicationLocales, "en-US", namespace),
    path.join(applicationLocales, "zh-CN", namespace),
  );
}

const pluginDirectories = await readdir(path.join(root, "plugins"), { withFileTypes: true });
for (const plugin of pluginDirectories.filter((entry) => entry.isDirectory())) {
  const locales = path.join(root, "plugins", plugin.name, "src/locales");
  await comparePair(path.join(locales, "en-US.json"), path.join(locales, "zh-CN.json"));
}
