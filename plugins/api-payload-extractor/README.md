# API报文提取

DevBox monorepo 中独立构建和发布的插件，用于从 API 日志中提取 `request.body`，并自动格式化 JSON 或 XML 入参。

## 功能

- 兼容包含 `response` 或历史拼写 `reponse` 的日志信封。
- 支持 Java 转义字符串和带前后缀的日志文本。
- 自动识别并格式化 JSON、XML；其他内容保留原文。
- 全程本地处理，不申请宿主权限，不包含默认示例数据。

## 开发

```bash
pnpm install
pnpm dev
```

## 验证与打包

```bash
pnpm check
pnpm package:zip
```

生成的 ZIP 位于仓库根目录 `release/`，可在 DevBox 的插件管理中安装。也可以在仓库根目录执行 `pnpm plugins:pack` 打包全部官方 UI 插件。
