import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { packPlugin } from "../packages/plugin-pack/src/index.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "fixtures/m2");
const output = path.join(fixtureRoot, "generated");
const keyId = "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4";
const privateKey = await readFile(path.join(fixtureRoot, "test-private-key.pem"), "utf8");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const [folder, version] of [
  ["v1", "1.0.0"],
  ["v2", "1.1.0"],
]) {
  const fileName = "devbox.fixture-" + version + ".zip";
  await packPlugin({
    source: path.join(fixtureRoot, folder),
    output: path.join(output, fileName),
    privateKey,
    keyId,
  });
}

process.stdout.write("M2 验收包已生成：" + output + "\n");
