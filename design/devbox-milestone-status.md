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

状态：**已完成，等待验收**

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

## M2：Java Runner 纵向切片

状态：**等待 M1 验收后开始**

下一阶段范围：Monaco 编辑器、JDK/JBang 探测、Java 运行/停止/超时、流式输出和运行历史。
