# DevBox Java Snippet Runner

DevBox monorepo 中独立构建和发布的 Java 代码片段插件。项目只处理单段 Java 代码的语法高亮、受控执行和结果展示，不提供工程编译、依赖管理、多文件项目或任意 Shell。

## 当前里程碑

M3 已完成，等待验收：

- Vite、React、TypeScript 独立工程
- CodeMirror Java 语法高亮
- 中英文界面
- 运行、输出、错误和状态布局
- Java 执行请求与结果协议
- 64 KiB 输入、5 秒执行、256 KiB 输出边界
- DevBox ZIP 插件 manifest
- `java:execute` 权限、Plugin API 和一次性用户手势校验
- 系统 JDK 11+ / JShell 发现、版本检查与当前版本展示
- 固定 JShell 参数和每次运行独立临时目录
- 64 KiB 输入、5 秒超时、256 KiB 输出与单插件单并发限制
- 正常输出、语法错误、运行异常、死循环和身份伪造回归
- 可重复构建的未签名 ZIP 和 SHA-256 输出
- DevBox 安装授权、启停、打开、执行、输出截断和卸载流程
- DevBox 设置语言与插件中英文界面的即时同步
- 用户指南、安全说明和发布检查表

本机 macOS 集成验收已通过；Windows 和 Linux 实机冒烟保留到跨平台发布阶段。

## 本地运行

```sh
pnpm install
pnpm dev
```

## 检查

```sh
pnpm check
```

## 生成安装包

在本目录运行：

```sh
pnpm package:zip
```

安装包输出到仓库根目录 `release/devbox.java-snippet-runner-<version>.zip`，命令会同时打印 SHA-256。相同源码和依赖连续打包应产生相同校验和。也可以在仓库根目录执行 `pnpm plugins:pack` 打包全部官方 UI 插件。

在 DevBox 中打开“插件管理 → 添加 ZIP 插件”，选择该文件，核对未签名警告、`java:execute` 权限和 SHA-256 后再安装。运行代码需要系统已安装 JDK 11 或更高版本，界面会显示宿主实际检测到的版本。

## 设计边界

- 使用系统 JDK 11+ 的 JShell，实际可用语法和标准库由本机版本决定。
- 每次运行创建独立 JShell 会话，不保留上次变量。
- 不调用 Maven、Gradle 或 javac 项目构建。
- 不开放命令字符串、工作目录或环境变量给插件。
- Host 负责超时、输出和进程生命周期限制。
- JShell 代码仍以当前用户权限运行，可能访问文件、网络或其他进程；独立会话不是操作系统级沙箱。

详细设计和任务见 [`design/`](./design/)。

更多说明见 [`docs/user-guide.zh-CN.md`](./docs/user-guide.zh-CN.md)、[`docs/security.zh-CN.md`](./docs/security.zh-CN.md) 和 [`docs/release-checklist.md`](./docs/release-checklist.md)。
