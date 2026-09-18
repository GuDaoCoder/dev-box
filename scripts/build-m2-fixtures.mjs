import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { packPlugin } from "../packages/plugin-pack/src/index.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "fixtures/m2");
const output = path.join(fixtureRoot, "generated");
const keyId = "625017f6bad8108a6db9de12eaec4cbff228d63fa6fb478316d479bd0639f7e4";
const privateKey = await readFile(path.join(fixtureRoot, "test-private-key.pem"), "utf8");
const baseUrl = process.env.DEVBOX_FIXTURE_BASE_URL ?? "http://127.0.0.1:4174";

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const versions = [];
for (const [folder, version] of [
  ["v1", "1.0.0"],
  ["v2", "1.1.0"],
]) {
  const fileName = "devbox.fixture-" + version + ".devbox-plugin";
  const result = await packPlugin({
    source: path.join(fixtureRoot, folder),
    output: path.join(output, fileName),
    privateKey,
    keyId,
  });
  versions.push({
    version,
    packageUrl: baseUrl + "/" + fileName,
    packageSha256: result.archiveSha256,
    devbox: ">=0.1.0, <0.2.0",
    pluginApi: "^1.0.0",
    releasedAt: new Date(0).toISOString(),
    releaseNotes: version === "1.0.0" ? "初始验收版本" : "更新与回退验收版本",
    revoked: false,
  });
}

await writeFile(
  path.join(output, "catalog.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date(0).toISOString(),
      plugins: [
        {
          id: "devbox.fixture",
          name: "M2 Fixture",
          description: "验证在线和离线插件分发链路。",
          publisher: "DevBox M2 Test Publisher",
          versions,
        },
      ],
    },
    null,
    2,
  ) + "\n",
);

process.stdout.write("M2 验收包已生成：" + output + "\n");
