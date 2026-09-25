import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";

const outputDirectory = new URL("../apps/desktop/dist/", import.meta.url);
const budgets = {
  ".css": 60 * 1024,
  // 编辑器与语言包按需加载，安装包内的基础 JS 总量允许高于首次启动体积。
  ".js": 1_200 * 1024,
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
const html = await readFile(new URL("index.html", outputDirectory), "utf8");
const entrySource = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
assert.ok(entrySource, "构建产物缺少入口脚本");
const entry = await stat(new URL(entrySource.replace(/^\//, ""), outputDirectory));
assert.ok(entry.size <= 450 * 1024, `首次启动脚本为 ${entry.size} 字节，超过 460800 字节预算`);
console.log(`startup JS: ${entry.size} / ${450 * 1024} bytes`);
for (const [extension, maximum] of Object.entries(budgets)) {
  const matching = files.filter(
    (file) =>
      file.pathname.endsWith(extension) &&
      (extension !== ".js" || !file.pathname.split("/").at(-1)?.startsWith("sql-")),
  );
  const sizes = await Promise.all(matching.map((file) => stat(file)));
  const total = sizes.reduce((sum, value) => sum + value.size, 0);
  assert.ok(matching.length > 0, `构建产物缺少 ${extension} 文件`);
  assert.ok(total <= maximum, `${extension} 产物为 ${total} 字节，超过 ${maximum} 字节预算`);
  console.log(`${extension} bundle: ${total} / ${maximum} bytes`);
}

// SQL 方言库仅在用户执行格式化时加载，独立限制其体积而不放宽基础包预算。
const sqlFormatterAssets = files.filter((file) =>
  /^sql-[^/]+\.js$/.test(file.pathname.split("/").at(-1) ?? ""),
);
assert.equal(sqlFormatterAssets.length, 1, "构建产物缺少独立 SQL 格式化资源");
const sqlFormatterSize = (await stat(sqlFormatterAssets[0])).size;
assert.ok(sqlFormatterSize <= 320 * 1024, `SQL 格式化资源超过 327680 字节预算`);
console.log(`SQL formatter JS: ${sqlFormatterSize} / ${320 * 1024} bytes`);
