import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";

const outputDirectory = new URL("../apps/desktop/dist/", import.meta.url);
const budgets = {
  ".css": 60 * 1024,
  ".js": 450 * 1024,
};

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const url = new URL(entry.name, directory);
      return entry.isDirectory() ? collectFiles(new URL(`${entry.name}/`, directory)) : [url];
    }),
  );
  return nested.flat();
}

const files = await collectFiles(outputDirectory);
for (const [extension, maximum] of Object.entries(budgets)) {
  const matching = files.filter((file) => file.pathname.endsWith(extension));
  const sizes = await Promise.all(matching.map((file) => stat(file)));
  const total = sizes.reduce((sum, value) => sum + value.size, 0);
  assert.ok(matching.length > 0, `构建产物缺少 ${extension} 文件`);
  assert.ok(total <= maximum, `${extension} 产物为 ${total} 字节，超过 ${maximum} 字节预算`);
  console.log(`${extension} bundle: ${total} / ${maximum} bytes`);
}
