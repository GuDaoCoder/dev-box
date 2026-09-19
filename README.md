# DevBox

DevBox 是一个本地优先的跨平台开发者工具箱，使用 Tauri 2、React、TypeScript、Vite 和 Rust 构建。

当前内置 JSON、时间戳、编码转换、UUID 与哈希工具；自定义功能可通过本地 ZIP 插件扩展。平台不提供在线插件目录，未签名插件允许安装，但会持续显示安全警告。

## 环境要求

- Node.js 20.19 或更高版本
- pnpm 12.4（未安装时可先执行 `corepack enable`）
- 稳定版 Rust，并安装 `rustfmt` 和 `clippy`
- [Tauri 2 对应平台的系统依赖](https://v2.tauri.app/start/prerequisites/)

## 本地运行

```sh
corepack enable
pnpm install
pnpm tauri dev
```

只调试浏览器界面时可运行 `pnpm dev`。浏览器模式不支持本地文件选择和插件 WebView。

## 检查与构建

```sh
pnpm check
pnpm build
pnpm test:e2e
pnpm check:release
pnpm tauri build
```

`pnpm check:release` 包含版本、语言、安全配置、格式、类型、单元测试、前端产物预算以及 Rust fmt、clippy 和测试。`pnpm tauri build` 在当前平台生成安装包。

## 文档

- [中文用户指南](./docs/user-guide.zh-CN.md) / [English User Guide](./docs/user-guide.en-US.md)
- [中文插件开发指南](./docs/plugin-development.zh-CN.md) / [Plugin Development Guide](./docs/plugin-development.en-US.md)
- [中文安全说明](./docs/security.zh-CN.md) / [Security Notes](./docs/security.en-US.md)
- [发布检查表](./docs/release-checklist.md)
- [架构设计与开发任务](./design/)

## 测试插件包

```sh
pnpm fixtures:m2
```

命令会在 `fixtures/m2/generated/` 生成用于安装、升级和回退验证的签名 ZIP。仓库中的测试私钥只用于本地测试，不能用于正式发布。
