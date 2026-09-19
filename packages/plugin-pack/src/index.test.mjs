import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { packPlugin, validateManifest, verifyPluginArchive } from "./index.mjs";

async function createFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "devbox-plugin-pack-"));
  await mkdir(path.join(directory, "dist"));
  await writeFile(path.join(directory, "dist/index.html"), "<!doctype html><title>Fixture</title>");
  await writeFile(
    path.join(directory, "plugin.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "devbox.fixture",
      name: "Fixture",
      version: "1.0.0",
      publisher: { id: "devbox", name: "DevBox Official", keyId: "0123456789abcdef" },
      engines: { devbox: ">=0.1.0", pluginApi: "^1.0.0" },
      type: "ui",
      entry: { main: "dist/index.html" },
      activationEvents: ["onView:fixture"],
      permissions: ["storage:read", "java:execute"],
      locales: {},
      contributes: {
        views: [
          {
            id: "fixture",
            titleKey: "fixture.title",
            icon: "plug",
            order: 1,
            category: {
              id: "examples",
              title: { "zh-CN": "示例", "en-US": "Examples" },
              order: 70,
            },
          },
        ],
      },
    }),
  );
  return directory;
}

describe("plugin-pack", () => {
  it("生成可重复验证的签名插件包", async () => {
    const source = await createFixture();
    const output = path.join(source, "fixture.zip");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    await packPlugin({ source, output, privateKey, keyId: "0123456789abcdef" });

    const result = await verifyPluginArchive({ archive: output, publicKey });

    expect(result.manifest.id).toBe("devbox.fixture");
    expect(result.manifest.permissions).toContain("java:execute");
    expect(result.archiveSha256).toHaveLength(64);
  });

  it("拒绝被篡改的插件文件", async () => {
    const source = await createFixture();
    const output = path.join(source, "fixture.zip");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    await packPlugin({ source, output, privateKey, keyId: "0123456789abcdef" });
    const archive = await readFile(output);
    const marker = archive.indexOf("<!doctype html>");
    archive[marker] ^= 1;

    await expect(verifyPluginArchive({ archive, publicKey })).rejects.toThrow("校验失败");
  });

  it("拒绝清单中的未知嵌套字段", () => {
    expect(() =>
      validateManifest({
        schemaVersion: 1,
        id: "devbox.fixture",
        name: "Fixture",
        version: "1.0.0",
        publisher: {
          id: "devbox",
          name: "DevBox",
          keyId: "0123456789abcdef",
          unexpected: true,
        },
        engines: { devbox: ">=0.1.0", pluginApi: "^1.0.0" },
        type: "ui",
        entry: { main: "dist/index.html" },
        activationEvents: [],
        permissions: [],
        locales: {},
        contributes: { views: [] },
      }),
    ).toThrow("publisher 字段无效");
  });
});
