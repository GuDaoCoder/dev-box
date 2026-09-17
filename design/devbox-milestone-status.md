# DevBox 开发里程碑状态

## M0：工程基线

状态：**已完成，已验收**

完成任务：

- [x] E0-01：pnpm workspace 与根脚本
- [x] E0-02：Tauri 2 + React + TypeScript + Vite 桌面应用
- [x] E0-03：Rust workspace、rustfmt 与 clippy
- [x] E0-04：共享 TypeScript、ESLint 与 Prettier 配置
- [x] E0-05：Vitest、React Testing Library 与 Rust test 基线
- [x] E0-06：Playwright 启动 smoke test
- [x] E0-07：Windows/macOS/Linux CI build matrix
- [x] E0-08：版本同步、Changelog 与产物命名规则

本地验证：

- `pnpm check`：通过
- `pnpm build`：通过
- `cargo fmt --all --check`：通过
- `cargo clippy --workspace --all-targets --all-features -- -D warnings`：通过
- `cargo test --workspace`：通过
- `pnpm test:e2e`：通过
- `pnpm tauri build --no-bundle`：通过（macOS arm64）

说明：Windows 与 Linux 构建步骤已配置在 GitHub Actions matrix 中；需要仓库推送到 GitHub 后才能取得对应平台的实际运行结果。

## M1：Shell 与平台骨架

状态：**已完成，已验收**

完成任务：

- [x] 建立语义色、深浅主题和 Button、Kbd、Badge 等公共 UI 基线
- [x] 实现顶栏、活动栏、导航栏、主工作区、状态栏和响应式降级
- [x] 实现命令面板及 `Ctrl/Cmd + K` 快捷键
- [x] 集成 `i18next + react-i18next`，支持系统语言、简体中文和英文
- [x] 增加中英文翻译键一致性检查
- [x] 实现语言和主题即时切换，并通过 Settings API 持久化
- [x] 建立版本化 IPC contracts、Plugin SDK 和 `DisposableStore`
- [x] 实现静态内置插件注册表生成、Plugin Manager 生命周期和插件错误隔离
- [x] 实现 Rust Command Gateway、版本/调用者/参数校验和结构化错误
- [x] 集成 SQLite migration、Settings Repository 和 revision 冲突检测
- [x] 建立 Foundation 内置验收插件，验证激活、受控 command 和设置保存闭环

本地验证：

- `pnpm check`：通过（TypeScript、ESLint、Prettier、Vitest、插件注册表）
- `pnpm build`：通过
- `cargo fmt --all --check`：通过
- `cargo clippy --workspace --all-targets --all-features -- -D warnings`：通过
- `cargo test --workspace`：通过（Gateway、参数校验、Repository、revision）
- `pnpm test:e2e`：通过（Shell 启动、插件页面、命令面板）
- `pnpm tauri build --no-bundle`：通过（macOS arm64）

验收入口：启动桌面应用后，在“平台基线”页面检查 Host、保存显示名称，再进入“设置”切换语言和主题。

## 路线调整（2026-09-17）

本次调整已经写入架构、界面规范和开发任务，后续里程碑以插件平台能力优先：

- `dev-box` 只负责桌面平台、Plugin SDK、安装器、权限与隔离、插件中心。
- 具体工具迁移到独立 Git 项目 `devbox-tools`，独立开发、测试、版本和发布。
- 首批只交付 JSON、时间戳、编码转换、UUID/Hash 四个常见通用工具。
- 在线与离线安装统一使用签名的 `.devbox-plugin` 包和同一套校验、安装、回滚流程。
- 在线目录首阶段仅收录官方插件；离线未签名包只能在用户显式开启开发者模式后安装。
- Java 编辑器、SQL Formatter、JWT、正则测试和 HTTP Client 不进入当前开发路线。

## M2：插件分发基础

状态：**等待新版任务拆解验收后开始**

下一阶段范围：

- 冻结 Plugin API、插件清单和 `.devbox-plugin` 包格式。
- 实现 SHA-256 完整性校验、Ed25519 签名验证和发布者信任模型。
- 实现兼容性检查、安全解包、原子安装、卸载、更新和失败回滚。
- 使用 SQLite 保存插件、版本、权限授权和安装事件。
- 使用独立 WebView 加载插件，默认不向插件开放 Tauri IPC。
- 打通在线目录安装与本地文件安装的统一流水线。

退出条件：官方签名的示例插件可通过在线目录和离线文件两种入口安装；篡改包、未知签名、越界文件和不兼容版本会被稳定拒绝；升级失败可恢复到上一版本。

## M3：官方通用工具

状态：**待开始**

下一阶段范围：建立独立 `devbox-tools` 仓库，开发 JSON、时间戳、编码转换、UUID/Hash 四个插件，并生成可供 M2 平台安装的签名包和在线目录索引。

## M4：插件中心完整体验

状态：**待开始**

下一阶段范围：已安装、在线、离线安装、更新四个页面，以及来源、签名、权限、进度、失败恢复和中英文状态反馈。

## M5：稳定性与发布

状态：**待开始**

下一阶段范围：跨平台端到端测试、安全回归、安装恢复、性能与无障碍检查，以及平台和官方插件的独立发布流程。
