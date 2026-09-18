#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { packPlugin, validateManifest, verifyPluginArchive } from "./index.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const [, , command, target] = process.argv;
  if (command === "validate" && target) {
    const manifest = JSON.parse(await readFile(`${target}/plugin.json`, "utf8"));
    validateManifest(manifest);
    process.stdout.write(`插件清单有效：${manifest.id}@${manifest.version}\n`);
    return;
  }
  if (command === "pack" && target) {
    const output = option("--output");
    const privateKeyPath = option("--key");
    const keyId = option("--key-id");
    if (!output || !privateKeyPath || !keyId)
      throw new Error("pack 需要 --output、--key 和 --key-id");
    const result = await packPlugin({
      source: target,
      output,
      privateKey: await readFile(privateKeyPath, "utf8"),
      keyId,
    });
    process.stdout.write(`${result.manifest.id}@${result.manifest.version} → ${output}\n`);
    return;
  }
  if (command === "verify" && target) {
    const publicKeyPath = option("--public-key");
    if (!publicKeyPath) throw new Error("verify 需要 --public-key");
    const result = await verifyPluginArchive({
      archive: target,
      publicKey: await readFile(publicKeyPath, "utf8"),
    });
    process.stdout.write(`签名有效：${result.manifest.id}@${result.manifest.version}\n`);
    return;
  }
  throw new Error(
    "用法：devbox-plugin-pack validate <目录> | pack <目录> --output <文件> --key <私钥> --key-id <ID> | verify <文件> --public-key <公钥>",
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
