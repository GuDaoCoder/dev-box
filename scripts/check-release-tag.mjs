import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tag = process.argv[2];
const workspacePackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const expected = `app-v${workspacePackage.version}`;

assert.equal(tag, expected, `发布标签必须与应用版本一致：应为 ${expected}`);
console.log(`Release tag ${tag} matches application version.`);
