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

每个视图都必须配置分类、分类中英文标题、功能顺序和图标。可用图标为 `binary`、`box`、`braces`、`clock`、`code`、`fingerprint`、`plug`。可申请的权限为 `storage:read`、`storage:write`、`clipboard:read`、`clipboard:write`、`java:execute`。

`java:execute` 用于通过系统 JDK 17+ 的 JShell 执行 Java 代码片段。调用必须由一次近期真实用户操作触发；Host 限制单次输入为 64 KiB、最长 5 秒、输出最多 256 KiB，并且同一插件同时只能运行一个片段。该能力不是操作系统沙箱，代码仍以当前用户权限运行，可能访问本机文件、网络或启动其他进程。插件必须在运行前向用户说明风险，且不能把它描述为安全沙箱。

## 跟随平台语言

插件从 `window.__DEVBOX_PLUGIN__.locale` 读取 DevBox 当前语言，取值为 `zh-CN` 或 `en-US`。用户在设置中切换语言后，Host 会向已打开的插件视图派发 `devbox:locale-change` 事件，新语言位于 `CustomEvent.detail`。插件应同时处理初始值和运行时事件，不要自行提供另一套语言切换入口。

## 校验和打包

在 DevBox 仓库中校验目录：

```sh
node packages/plugin-pack/src/cli.mjs validate ./my-plugin
```

未签名插件可用标准 ZIP 工具打包，确保压缩包根目录是 `plugin.json`、`dist/` 和可选的 `locales/`。DevBox 会允许安装，但始终显示未签名警告。

也可以使用 DevBox 打包器生成内容可重复的未签名 ZIP：

```sh
node packages/plugin-pack/src/cli.mjs pack ./my-plugin \
  --output ./my-plugin-1.0.0.zip \
  --unsigned
```

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
- Java 片段执行要求 `java:execute` 授权和短时一次性用户手势令牌；插件只能提交代码和资源上限，不能指定 JShell 路径或命令行参数。
- 不要依赖 `file://`、绝对路径、父目录路径、符号链接或远程脚本。

包限制：ZIP 最大 25 MiB，展开后最大 50 MiB，单文件最大 8 MiB，最多 512 个文件，单文件压缩比不超过 100。
