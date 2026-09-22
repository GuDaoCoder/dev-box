# Java 代码片段执行器设计

## 目标

提供一个在 DevBox monorepo 内维护、独立构建和发布的官方插件，用于输入、语法高亮并运行 Java 代码片段。执行语义基于 JShell，不实现完整 Java 工程编译器或项目 IDE。

## 范围

包含：

- 单代码块编辑与 Java 关键字、字符串、数字、注释高亮。
- 使用快捷键或按钮运行整个代码块。
- 展示标准输出、标准错误、状态、耗时和退出码。
- 中文和英文界面。
- 输入、时间、输出和并发限制。

不包含：

- Maven/Gradle、外部依赖、classpath 配置。
- 多文件、包结构、调试器、断点或语言服务器。
- DevBox 的任意 Shell API、任意进程 API、文件系统 API 或网络 API。
- 长期保留 JShell 会话或运行历史。

Java 代码仍由系统 JShell 以当前用户权限运行，可能通过 Java 标准库访问本机文件、网络或启动进程。临时目录和独立进程用于清理与资源控制，不构成操作系统级安全沙箱；安装和运行界面必须明确提示该风险。

## 架构

```text
Java Runner Plugin WebView
  ├─ CodeMirror Java editor
  ├─ execution state and output
  └─ JavaRunner API request
              ↓
DevBox Rust Host
  ├─ verify plugin identity and java:execute grant
  ├─ discover approved system JShell
  ├─ start one temporary JShell process with fixed arguments
  ├─ enforce timeout and output limit
  └─ return structured result
```

插件不传递命令行，只提交 `source`、`timeoutMs` 和 `maxOutputBytes`。Host 对后两个值再次限幅，不信任插件参数。

## 里程碑

### M1：独立工程与交互骨架

- 独立 Vite/React/TypeScript workspace 包，共享 monorepo 的锁文件、SDK 和 CI。
- CodeMirror Java 高亮、运行和输出界面。
- 中英文和键盘快捷键。
- JavaRunner 请求/响应协议和边界测试。

### M2：受控 JShell Host

- DevBox 新增 `java:execute` 权限和结构化 IPC。
- 发现 JDK 11+ 与 JShell、显示当前环境版本，并使用固定参数启动。
- 每次请求使用独立临时目录和进程，但不宣称为操作系统级沙箱。
- 5 秒超时、64 KiB 输入、256 KiB 输出、单插件单并发。
- 身份伪造、参数越界、超时和进程清理测试。

### M3：打包与集成验收

- 状态：已完成，等待验收。
- 插件声明 `java:execute` 并完成安装授权。
- 构建可安装 ZIP。
- 在 DevBox Tab 内完成中文、英文、成功、语法错误、运行异常和超时验收。
- 补充用户文档和发布检查表。
