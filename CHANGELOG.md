# Changelog

DevBox 使用语义化版本，公开 Plugin API 单独保持显式版本。

## [Unreleased]

### Added

- JSON、时间戳、Base64/URL/Hex、UUID v4 和 SHA-2 平台内置工具。
- 分类/功能二级菜单树和内存多 Tab 工作区，支持单例打开、关闭、拖动排序和右键批量关闭。
- Tab 方向键、Home/End、Delete 键操作及功能树、Tab/Panel 读屏关系。
- 仅本地 ZIP 的自定义插件安装、未签名风险确认和持续安全标识。
- 插件视图分类、图标、顺序和主工作区 child WebView。
- ZIP 路径穿越、重复文件、数量、压缩比和不完整签名安全回归。
- CSP、WebView 能力边界、桥接密钥和用户手势的配置检查。
- 前端 JS/CSS 产物大小预算和首屏、Tab 切换性能冒烟测试。
- Windows、macOS、Linux 安装包发布流水线和发布标签校验。
- 中英文用户、插件开发、安全说明及发布检查表。

### Changed

- 语言切换只保留在设置页，继续支持系统、简体中文和英文。
- 插件能力调整为用户添加本地 ZIP；移除在线目录、在线安装和自动更新。
- 插件功能从独立窗口改为工作区 Tab，关闭 Tab 时销毁对应 WebView。
- 四个常用工具从独立 `devbox-tools` 项目迁入当前仓库。
- 主界面和插件资源 CSP 进一步限制脚本、对象、base URI、frame、网络和表单能力。

### Removed

- 在线插件目录、下载 API 和 Online 界面。
- `.devbox-plugin` 专用扩展名入口，统一使用 `.zip`。
- 左侧工具/插件活动栏切换按钮。
