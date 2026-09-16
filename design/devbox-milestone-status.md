# DevBox 开发里程碑状态

## M0：工程基线

状态：**已完成，等待验收**

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

状态：**等待 M0 验收后开始**

下一阶段范围：App Shell、Design System、国际化基础、Plugin SDK/Manager、Command Gateway、SQLite/Repository 最小闭环。
