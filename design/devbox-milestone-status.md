# DevBox 开发里程碑状态

> 更新日期：2026-09-19

## M0：工程基线

状态：**已完成，已验收**

- [x] pnpm workspace、Tauri 2、React、TypeScript、Vite 和 Rust workspace
- [x] ESLint、Prettier、Vitest、Rust test、Playwright 和 CI matrix
- [x] 版本同步、Changelog 与产物命名

## M1：Shell 与平台骨架

状态：**已完成，已验收**

- [x] 语义色、深浅主题、公共 UI、Shell 和命令面板
- [x] `zh-CN` / `en-US` 国际化与设置持久化
- [x] Plugin SDK、版本化 IPC、Command Gateway 和结构化错误
- [x] SQLite migration、Settings Repository 和 revision 冲突检测

## M2：插件分发基础

状态：**已完成，已验收**

- [x] Plugin API 1.0、manifest、包解析、checksum 和 Ed25519 验证
- [x] 安全解包、兼容性检查、staging、原子安装和启动恢复
- [x] 启用、禁用、回退、运行时失败恢复和卸载
- [x] SQLite 插件、版本、权限和安装事件
- [x] 隔离 WebView、Host 身份绑定、scoped settings 和剪贴板网关

说明：M2 验收时实现过在线目录与专用包扩展名；产品路线已在 M3 调整为仅本地 ZIP，安全安装和运行时基础继续复用。

## 路线调整（2026-09-18）

- JSON、Timestamp、Encoding、UUID/Hash 改为 `dev-box` 平台内置功能。
- 四个工具从 `devbox-tools` 迁回，完成验证后删除旧项目。
- 插件仅支持用户添加本地 ZIP，不提供在线安装或目录。
- 允许未签名 ZIP；无开发者模式，但安装前后必须持续警告。
- 左侧改为分类/功能二级树，移除工具/插件活动栏切换按钮。
- 功能统一以多 Tab 打开；同功能单例、支持关闭和拖动排序，重启不恢复。
- 插件在主窗口附属 WebView 中运行，不创建独立功能窗口。
- 语言切换只放在设置页，支持中文和英文。

## M3：工作区与内置工具重构

状态：**已完成，已验收**

已完成：

- [x] 建立内置功能分类和注册表
- [x] 左侧改为分类/功能二级树
- [x] 建立仅内存的多 Tab 工作区、单例打开、关闭和拖放排序
- [x] JSON、Timestamp、Encoding、UUID/Hash 迁入平台并接入中英文
- [x] 删除插件在线目录和在线安装 UI/API
- [x] 文件选择器与 Host 只接受 `.zip`
- [x] 允许未签名 ZIP，并在安装确认和列表中展示警告
- [x] 插件 manifest 视图增加分类、图标和顺序
- [x] 插件从独立窗口改为工作区 child WebView

验证与收口：

- [x] 完成前端组件、Tab、工具算法和 Rust 安装回归
- [x] 更新 fixture、README、设计说明和开发任务
- [x] 通过完整 lint、类型、单测、构建、clippy 和 E2E
- [x] 确认迁移完整后将 `devbox-tools` 移入废纸篓
- [x] 提交代码并进入用户验收

旧项目恢复位置：`/Users/zane.zou/.Trash/devbox-tools-20260919`。

## M4：稳定性与发布

状态：**开发完成，待三平台 CI 与用户验收**

- [ ] Windows、macOS、Linux 安装、升级和卸载实机验证
- [x] macOS `.app` 与 DMG 本机发布构建
- [x] ZIP 解析、IPC 越权、CSP 与身份绑定安全回归
- [x] 前端产物预算、首屏和 Tab 切换性能冒烟
- [x] 中英文键盘、焦点关系和读屏语义回归
- [x] 用户安装说明、插件 ZIP 制作说明和安全说明
- [x] 三平台发布产物流水线与最终检查表

说明：三平台编译与安装包生成已进入 CI；本机已生成 macOS `.app` 与 DMG。安装、升级和卸载需要等待对应平台流水线及实机验收后勾选。
