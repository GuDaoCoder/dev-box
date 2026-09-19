# DevBox ZIP 插件开发指南

## 最小目录

```text
my-plugin/
├── plugin.json
├── dist/
│   ├── index.html
│   ├── plugin.js
│   └── style.css
└── locales/
    ├── zh-CN.json
    └── en-US.json
```

ZIP 根目录必须直接包含 `plugin.json`，不能再套一层项目目录。运行时只接受 `type: "ui"` 的插件。

## 清单示例

```json
{
  "schemaVersion": 1,
  "id": "devbox.example.converter",
  "name": "Example Converter",
  "description": "示例转换工具",
  "version": "1.0.0",
  "publisher": { "id": "example-team", "name": "Example Team" },
  "engines": { "devbox": ">=0.1.0, <0.2.0", "pluginApi": "^1.0.0" },
  "type": "ui",
  "entry": { "main": "dist/index.html" },
  "activationEvents": ["onView:converter"],
  "permissions": ["storage:read", "storage:write"],
  "locales": {
    "zh-CN": "locales/zh-CN.json",
    "en-US": "locales/en-US.json"
  },
  "contributes": {
    "views": [
      {
        "id": "converter",
        "titleKey": "converter.title",
        "icon": "code",
        "order": 10,
        "category": {
          "id": "conversion",
          "title": { "zh-CN": "转换", "en-US": "Conversion" },
          "order": 40
        }
      }
    ]
  }
}
```

每个视图都必须配置分类、分类中英文标题、功能顺序和图标。可用图标为 `binary`、`box`、`braces`、`clock`、`code`、`fingerprint`、`plug`。可申请的权限仅为 `storage:read`、`storage:write`、`clipboard:read`、`clipboard:write`。

## 校验和打包

在 DevBox 仓库中校验目录：

```sh
node packages/plugin-pack/src/cli.mjs validate ./my-plugin
```

未签名插件可用标准 ZIP 工具打包，确保压缩包根目录是 `plugin.json`、`dist/` 和可选的 `locales/`。DevBox 会允许安装，但始终显示未签名警告。

正式分发建议使用 Ed25519 签名包。先把公钥对应的 `keyId` 写入 `publisher.keyId`，再执行：

```sh
node packages/plugin-pack/src/cli.mjs pack ./my-plugin \
  --output ./my-plugin-1.0.0.zip \
  --key ./ed25519-private-key.pem \
  --key-id <key-id>
```

可用公钥验证产物：

```sh
node packages/plugin-pack/src/cli.mjs verify ./my-plugin-1.0.0.zip \
  --public-key ./ed25519-public-key.pem
```

不要把生产私钥提交到 Git；仓库内 fixture 私钥只用于测试。

## 宿主边界

- 插件在独立的 `plugin-*` WebView 中运行，不能直接获得文件选择权限。
- 网络连接被插件 CSP 禁止。
- 存储按插件 ID 隔离，并检查用户授权。
- 剪贴板操作要求已授权权限；敏感写入还要求短时一次性用户手势令牌。
- 不要依赖 `file://`、绝对路径、父目录路径、符号链接或远程脚本。

包限制：ZIP 最大 25 MiB，展开后最大 50 MiB，单文件最大 8 MiB，最多 512 个文件，单文件压缩比不超过 100。
