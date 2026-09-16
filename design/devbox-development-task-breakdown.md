# DevBox MVP 开发任务拆解

> 输入文档：`devbox-architecture-design.md`、`devbox-ui-design-spec.md`
> 范围：第一阶段 MVP，覆盖 Windows / macOS / Linux、五个内置插件、简体中文和英文。
> 任务粒度：单个任务原则上可在 0.5–3 个开发日内完成；超过该范围的任务应继续拆分。

## 1. 里程碑与交付顺序

| 里程碑 | 目标 | 主要交付 | 退出条件 |
|---|---|---|---|
| M0 工程基线 | 建立可持续开发的 monorepo | Tauri/React/Rust workspace、CI、代码规范 | 三个平台可以构建空壳应用 |
| M1 Shell 与平台骨架 | 打通 UI、插件、IPC、存储最小闭环 | App Shell、i18n、Plugin SDK、Gateway、SQLite | 内置测试插件可激活、保存设置、调用受控 command |
| M2 Java Runner 纵向切片 | 优先验证最高风险链路 | Monaco → IPC → JBang/JDK → 流式输出 → Stop → 历史 | Java 示例可运行、停止、超时、恢复 |
| M3 通用工具插件 | 验证统一 UI 和纯前端插件模式 | JSON、Timestamp、SQL | 三个插件功能完整且双语可用 |
| M4 HTTP 与权限 | 验证网络能力和权限模型 | HTTP Client、host allowlist、权限 UI | 未授权请求被拒绝，授权请求可查看响应 |
| M5 稳定性与发布 | 达到 MVP 可分发标准 | 安全加固、E2E、诊断、三平台安装包 | MVP 验收标准全部通过 |

建议严格按 M0 → M1 → M2 推进。M2 完成后，M3、M4 和 M5 中不依赖功能冻结的工作可以并行。

## 2. 优先级、规模和完成定义

- **P0**：MVP 阻塞项，不完成则无法形成可发布产品。
- **P1**：MVP 应完成项；必要时只能缩减体验，不能破坏安全边界。
- **P2**：可延后优化项，不阻塞 MVP。
- **S**：约 0.5–1 天；**M**：约 1–2 天；**L**：约 2–3 天。规模仅用于排期，不代替团队估算。

单个任务的统一完成定义：

1. 功能代码、类型和错误分支已完成。
2. 用户可见文案同时提供 `zh-CN` 和 `en-US`。
3. 单元/组件测试覆盖核心成功和失败路径。
4. 涉及 IPC、权限或数据写入时，Host 侧存在独立校验。
5. 无未说明的 lint、类型或测试失败。
6. 对应文档、错误码和变更说明已更新。

## 3. Epic 依赖关系

```text
E0 工程基线
 ├─ E1 UI / Design System ── E2 国际化
 ├─ E3 插件平台
 ├─ E4 IPC / 权限 / Host
 └─ E5 SQLite / Repository
          │
          ├──────────────┐
          ↓              ↓
 E6 Java Host       E8 纯前端插件
          ↓
 E7 Java UI
          │
 E4 权限 ─┴──────→ E9 HTTP Client
          │
          ↓
 E10 设置 / 日志 / 恢复
          ↓
 E11 跨平台测试 / 打包 / 发布
```

关键路径：`E0 → E3/E4/E5 → E6 → E7 → E11`。

## 4. E0：工程与交付基线

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E0-01 | P0 | M | 初始化 pnpm workspace 与根脚本 | 无 | `apps`、`packages`、`plugins` 可统一安装、构建、测试 |
| E0-02 | P0 | M | 初始化 Tauri 2 + React + TypeScript + Vite 桌面应用 | E0-01 | 开发模式可启动，生产模式可构建 |
| E0-03 | P0 | S | 建立 Rust workspace/crate、格式化与 lint 配置 | E0-02 | `cargo fmt`、`cargo clippy` 可在 CI 执行 |
| E0-04 | P0 | S | 建立 TypeScript、ESLint、Prettier 共享配置 | E0-01 | 所有前端包复用同一配置 |
| E0-05 | P0 | M | 建立 Vitest、React Testing Library 和 Rust test 基线 | E0-02 | 前后端示例测试在本地和 CI 通过 |
| E0-06 | P0 | M | 建立 Playwright 桌面关键流程测试骨架 | E0-02 | CI 可启动应用并完成一个 smoke test |
| E0-07 | P0 | M | 建立 Windows/macOS/Linux CI matrix | E0-03～06 | 三个平台完成检查与构建 |
| E0-08 | P1 | S | 建立版本、变更记录与构建产物命名规则 | E0-01 | 版本可注入前端、Rust 和安装包 |

## 5. E1：App Shell 与 Design System

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E1-01 | P0 | M | 配置 TailwindCSS、shadcn/ui 基线和语义颜色 token | E0-02 | 深色/浅色组件均只使用语义 token |
| E1-02 | P0 | M | 实现 App Shell：顶栏、图标轨、导航侧栏、主工作区、状态栏 | E1-01 | 布局符合设计尺寸，可随窗口缩放 |
| E1-03 | P0 | M | 实现页面标题、Toolbar、Button、Kbd、Tabs、Badge、Tooltip | E1-01 | 各插件可复用，键盘焦点清晰 |
| E1-04 | P0 | M | 实现 SplitPanel、Inspector、BottomPanel 和尺寸持久化 | E1-02 | 面板可拖动、折叠并恢复上次比例 |
| E1-05 | P0 | M | 实现表单、KeyValueEditor、空状态、加载和行内错误组件 | E1-01 | HTTP/Java 参数无需自定义基础控件 |
| E1-06 | P0 | M | 实现命令面板及 `Ctrl/Cmd + K` | E1-02 | 可搜索页面与命令，键盘可完整操作 |
| E1-07 | P1 | M | 实现全局快捷键冲突解析和快捷键帮助页 | E1-06 | 全局与插件快捷键不会重复触发 |
| E1-08 | P0 | M | 实现响应式降级：检查器抽屉、分栏转标签 | E1-04 | 960 px、760 px 两个断点行为符合规范 |
| E1-09 | P0 | M | 建立 App Shell 与公共组件可访问性测试 | E1-02～08 | 图标有名称，焦点顺序合理，状态不只依赖颜色 |
| E1-10 | P1 | M | 建立核心页面截图回归基线 | E1-02～08 | JSON、Java、HTTP、权限、设置页有基准图 |

## 6. E2：国际化

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E2-01 | P0 | M | 集成 `i18next + react-i18next`，定义 locale 与 fallback | E0-02 | 支持 `system`、`zh-CN`、`en-US`，fallback 为 `en-US` |
| E2-02 | P0 | M | 建立 `common/settings/errors` namespace 和类型安全 key 约束 | E2-01 | 错误 key 在构建期可发现，Core 文案无硬编码 |
| E2-03 | P0 | M | 实现语言设置、即时切换和持久化 | E2-01、E5-04 | 切换后无需重启，重新打开应用仍保持设置 |
| E2-04 | P0 | M | 实现插件 locale 注册、卸载和 fallback | E2-01、E3-05 | 每个插件使用独立 namespace |
| E2-05 | P0 | S | 建立日期、数字、相对时间和列表格式化工具 | E2-01 | 所有展示通过 `Intl` 并随语言更新 |
| E2-06 | P0 | M | 建立错误码到双语文案的映射层 | E2-02、E4-04 | IPC 不返回需直接展示的最终文案 |
| E2-07 | P0 | S | CI 校验中英文 key 对齐、空值和缺失 key | E2-02 | 缺失翻译时 CI 失败 |
| E2-08 | P1 | M | 建立中英文截图与长文案布局测试 | E2-03、E1-10 | 两种语言无关键按钮截断或布局溢出 |

## 7. E3：插件平台与 Plugin SDK

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E3-01 | P0 | M | 定义 `plugin-manifest.schema.json` 与 TypeScript 类型 | E0-01 | 文档中的字段、长度、枚举和未知字段策略可校验 |
| E3-02 | P0 | M | 实现构建期 manifest 校验和内置插件注册表生成 | E3-01 | 重复 ID、非法路径、版本不兼容导致构建失败 |
| E3-03 | P0 | M | 实现 Plugin Manager 状态机 | E3-02 | discovered → validated → loaded → active 可追踪 |
| E3-04 | P0 | M | 实现 activate/deactivate、超时、DisposableStore | E3-03 | 激活失败不影响 Shell 与其他插件 |
| E3-05 | P0 | L | 实现 Plugin SDK v1：view、command、settings、notification | E3-03、E4-05 | 插件不直接依赖 Tauri invoke 和内部 store |
| E3-06 | P0 | M | 实现按授权裁剪 PluginAPI | E3-05、E4-06 | 未授权 API 为不可用，Host 调用仍二次鉴权 |
| E3-07 | P0 | M | 实现插件路由、导航贡献和命令贡献 | E3-05、E1-02 | manifest contribution 可进入侧栏和命令面板 |
| E3-08 | P1 | M | 实现插件级 Error Boundary 和 degraded 状态页 | E3-03、E1-05 | 单插件崩溃可重试或禁用，不影响应用 |
| E3-09 | P0 | M | 建立 manifest、生命周期和 API 类型测试 | E3-01～08 | 关键状态与兼容性错误均有自动测试 |

## 8. E4：IPC、权限与 Rust Host

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E4-01 | P0 | M | 定义版本化 IPC envelope、DTO 和共享 contracts 包 | E0-02 | `apiVersion/requestId/pluginId/payload` 类型统一 |
| E4-02 | P0 | M | 实现 Rust AppState 与 Command Gateway | E4-01 | 所有 command 统一经过解析、校验、错误映射 |
| E4-03 | P0 | M | 实现调用者解析和 window/plugin 绑定 | E4-02 | 伪造其他 pluginId 的调用被拒绝 |
| E4-04 | P0 | M | 实现稳定 `DevBoxError`、correlationId 与 source chain 映射 | E4-02 | UI 只收到脱敏、稳定、可本地化的错误结构 |
| E4-05 | P0 | M | 实现前端 invoke/event client 与 listener 释放 | E4-01、E4-04 | 长任务事件带 runId/seq，取消订阅不泄漏 |
| E4-06 | P0 | L | 实现权限 grant 存储、查询、更新和调用时鉴权 | E4-02、E5-03 | 未授权能力稳定返回 `PERMISSION_DENIED` |
| E4-07 | P0 | M | 实现参数大小、范围、超时和速率校验基础设施 | E4-02 | 非法请求在进入 service 前被拒绝 |
| E4-08 | P0 | M | 配置 Tauri capability 与 CSP | E4-02 | 主窗口无任意 shell、远程脚本或 eval 能力 |
| E4-09 | P0 | M | 建立权限绕过、路径/参数和敏感信息测试 | E4-03～08 | 安全回归在 CI 中运行 |

## 9. E5：SQLite、Repository 与设置

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E5-01 | P0 | M | 集成 SQLite、连接管理、WAL 和 migration runner | E0-03 | 新库可初始化，旧版本可按顺序迁移 |
| E5-02 | P0 | M | 创建 plugins、permissions、settings 表与 Repository | E5-01 | 插件状态和授权可事务化读写 |
| E5-03 | P0 | M | 创建 snippets、execution_history 表与 Repository | E5-01 | 支持列表、保存、删除和分页 |
| E5-04 | P0 | M | 实现全局/Runtime/插件/session 设置服务与 revision | E5-01 | 并发更新冲突可检测，更新产生 change event |
| E5-05 | P0 | M | 实现 migration 前备份与失败回滚 | E5-01 | 失败后数据库可恢复，不留下半迁移状态 |
| E5-06 | P0 | S | 实现应用异常退出后的 running → orphaned 修复 | E5-03 | 下次启动不会显示永久运行中任务 |
| E5-07 | P1 | M | 实现历史保留、preview 截断和容量清理策略 | E5-03 | 历史和输出不会无限增长 |
| E5-08 | P0 | M | 建立 Repository、事务、revision 和 migration 测试 | E5-01～07 | 正常、冲突、回滚和升级路径均覆盖 |

## 10. E6：Java Runner Host 能力

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E6-01 | P0 | M | 定义 Java DTO、事件、错误码和 Host service 接口 | E4-01 | discover/run/stop/event contract 固定 |
| E6-02 | P0 | L | 实现 JDK/JBang 探测、去重、验证与 5 分钟缓存 | E6-01 | configured、JAVA_HOME、PATH、JBang 来源可区分 |
| E6-03 | P0 | L | 实现 ProcessManager：spawn、registry、runId、owner | E4-02 | 进程只可由所属插件查询和停止 |
| E6-04 | P0 | L | 实现跨平台进程树停止 | E6-03 | Unix process group、Windows Job Object 无孤儿孙进程 |
| E6-05 | P0 | M | 实现 Java 临时目录、原子源码写入与清理 | E6-01 | 路径不可由前端指定，结束后按策略清理 |
| E6-06 | P0 | L | 实现 JBang 模式的 argv 安全构造与依赖校验 | E6-02～05 | 空格、Unicode、shell 元字符均作为原始参数传递 |
| E6-07 | P0 | L | 实现 javac/java 两阶段运行 | E6-02～05 | 编译和运行共享 runId，阶段耗时可记录 |
| E6-08 | P0 | L | 实现 stdout/stderr 流、seq、合并、背压和截断 | E6-03 | 输出超限产生 truncated，内存保持有界 |
| E6-09 | P0 | M | 实现 timeout、用户 Stop 和唯一终态 | E6-03、E6-04 | 超时/停止错误码不同，终态只发送一次 |
| E6-10 | P0 | M | 实现环境净化、JVM 参数白名单和资源限制 | E6-03 | 危险 agent/启动钩子被拒绝，默认限制生效 |
| E6-11 | P0 | M | 写入 execution_history 并处理源码快照策略 | E5-03、E6-08～10 | 成功、失败、取消、超时均有正确摘要 |
| E6-12 | P0 | L | 建立 Java 集成与安全测试矩阵 | E6-02～11 | 文档第 21 节的 Java 架构测试全部自动化 |

## 11. E7：Java Runner UI

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E7-01 | P0 | M | 封装 Monaco `CodeEditor` 和主题同步 | E1-01、E6-01 | 稳定 model URI，主题切换不丢内容 |
| E7-02 | P0 | M | 实现 snippet tab、dirty 状态、自动保存与关闭确认 | E7-01、E5-03 | 切换 tab 保留 undo，未保存关闭有提示 |
| E7-03 | P0 | M | 实现 Run Configuration 检查器 | E1-05、E6-02 | JDK、Mode、Dependencies、Args、Timeout 可配置 |
| E7-04 | P0 | M | 实现 Run/Stop 状态机和快捷键 | E7-01、E6-06～09 | 运行时 Run 禁用，Stop 可用，重复触发被防止 |
| E7-05 | P0 | L | 实现流式 Output、stderr、截断和虚拟化 | E6-08、E1-04 | 大输出不卡顿，顺序异常可检测 |
| E7-06 | P0 | M | 实现 Problems marker 与编译诊断跳转 | E7-01、E6-07 | 点击诊断可定位编辑器行列 |
| E7-07 | P0 | M | 实现 History 列表、详情、重新运行和删除 | E5-03、E6-11 | 历史状态与数据库一致 |
| E7-08 | P0 | S | 增加本机代码执行风险提示 | E1-05 | 页面始终展示清晰的持久 warning |
| E7-09 | P0 | M | 补齐 Java Runner 中英文资源 | E2-04、E7-01～08 | 两种语言无硬编码和关键布局溢出 |
| E7-10 | P0 | L | 建立 Java Runner 组件与 E2E 测试 | E7-01～09 | Run、Stop、timeout、error、history 流程通过 |

## 12. E8：JSON、Timestamp、SQL 插件

### JSON Tool

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E8-01 | P0 | M | 创建 JSON manifest、路由、命令和 locale | E3-07、E2-04 | 插件可激活并进入侧栏/命令面板 |
| E8-02 | P0 | M | 实现格式化、压缩、校验和错误定位 | E8-01、E1-04 | 大小限制内输入结果正确，错误可定位 |
| E8-03 | P0 | S | 实现 Copy、Clear、Wrap 和输入输出状态 | E8-02 | 局部动作作用域正确，有键盘和可访问名称 |
| E8-04 | P0 | M | JSON 单元、组件和双语 E2E 测试 | E8-01～03 | 成功、无效 JSON、空输入均覆盖 |

### Timestamp

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E8-05 | P0 | S | 创建 Timestamp manifest、路由、命令和 locale | E3-07、E2-04 | 插件可激活并正确卸载 |
| E8-06 | P0 | M | 实现秒/毫秒识别、当前时间和日期转换 | E8-05、E2-05 | 边界值、负时间戳和无效输入处理正确 |
| E8-07 | P0 | M | 实现时区选择、多时区结果和复制 | E8-06 | DST 场景使用标准 API，单位明确可见 |
| E8-08 | P0 | M | Timestamp 单元、组件和双语 E2E 测试 | E8-05～07 | 中英文格式与核心边界场景通过 |

### SQL Tool

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E8-09 | P0 | S | 创建 SQL manifest、路由、命令和 locale | E3-07、E2-04 | 插件可激活并进入统一分栏模板 |
| E8-10 | P0 | M | 选型并封装前端 SQL formatter | E8-09 | 依赖被隔离在插件内部，可替换 |
| E8-11 | P0 | M | 实现格式化、方言选择、错误和复制 | E8-10 | 支持 MVP 方言，失败不破坏原始输入 |
| E8-12 | P0 | M | SQL 单元、组件和双语 E2E 测试 | E8-09～11 | 方言、无效 SQL、空输入均覆盖 |

## 13. E9：HTTP Client 与网络权限

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E9-01 | P0 | M | 定义 Scoped HTTP DTO、错误和响应限制 | E4-01 | 不暴露通用 fetch/shell，contract 可版本化 |
| E9-02 | P0 | L | 实现 host/method allowlist 和 URL 规范化 | E4-06、E9-01 | 默认拒绝 file、loopback、私网和未声明 host |
| E9-03 | P0 | M | 实现超时、重定向、响应大小和 TLS 策略 | E9-02 | 限制稳定生效，普通插件不能关闭 TLS 校验 |
| E9-04 | P0 | M | 实现敏感 header/cookie 脱敏 | E9-02、E10-01 | 日志和历史不出现 token、Authorization、Cookie |
| E9-05 | P0 | M | 创建 HTTP Client manifest、权限和 locale | E3-07、E2-04、E9-01 | 插件仅获得声明并授权的网络能力 |
| E9-06 | P0 | L | 实现请求编辑器：method、URL、params、headers、body、auth | E1-05、E9-05 | 可构造请求且不通过字符串拼接敏感参数 |
| E9-07 | P0 | L | 实现响应视图：Pretty、Raw、Headers、状态指标 | E9-03、E9-06 | 状态码、耗时、大小和截断清晰展示 |
| E9-08 | P1 | M | 实现本地请求历史与重新发送 | E5-03、E9-06 | 敏感内容不被普通历史持久化 |
| E9-09 | P0 | M | 实现权限拒绝、超时、离线和证书错误 UI | E9-02～07、E2-06 | 每类错误都有可执行建议 |
| E9-10 | P0 | L | 建立 mock server 集成、安全和双语 E2E 测试 | E9-01～09 | allowlist、SSRF、防泄密和正常请求均覆盖 |

## 14. E10：设置、插件管理、日志与恢复

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E10-01 | P0 | M | 实现结构化日志、字段规范和脱敏 | E4-04 | 日志包含上下文字段且不记录秘密/用户代码 |
| E10-02 | P0 | M | 实现 rolling、容量、保留天数和日志设置 | E10-01、E5-04 | 日志不会无限增长，设置可即时生效 |
| E10-03 | P1 | L | 实现诊断包预览、二次脱敏和导出 | E10-01、E4-07 | 仅写入用户选择目标，导出内容可预览 |
| E10-04 | P0 | L | 实现设置页：General、Appearance、Runtime、Plugins、Privacy & Logs | E1、E2、E5-04 | 所有 MVP 设置可查、可改、可恢复 |
| E10-05 | P0 | M | 实现插件列表、启停、状态和失败详情 | E3-03、E5-02 | 禁用插件后导航/命令/资源正确释放 |
| E10-06 | P0 | L | 实现权限列表、grant 变更和风险提示 | E4-06、E10-05 | 权限范围、状态和变更结果可审计 |
| E10-07 | P0 | M | 实现 Runtime/JDK/JBang 探测与刷新 UI | E6-02、E10-04 | 修改路径后重新探测，不影响运行中任务 |
| E10-08 | P0 | M | 实现启动恢复页和禁用第三方插件模式入口 | E3-08、E5-06 | 致命启动问题可诊断并进入安全模式 |
| E10-09 | P0 | L | 设置、插件、权限和恢复流程 E2E | E10-01～08 | 中英文与权限变更关键路径通过 |

## 15. E11：质量、安全与发布

| ID | 优先级 | 规模 | 任务 | 依赖 | 验收结果 |
|---|---|---:|---|---|---|
| E11-01 | P0 | M | 完成三平台功能 smoke test | M2～M4 | 五个插件均可启动并完成主要操作 |
| E11-02 | P0 | L | 完成 Java 进程树、超时、海量输出压力测试 | E6-12、E7-10 | 无孤儿进程、内存无无界增长 |
| E11-03 | P0 | L | 完成 IPC、插件权限和 HTTP SSRF 安全测试 | E4-09、E9-10 | 已知绕过路径均被拒绝并产生审计记录 |
| E11-04 | P0 | M | 完成 SQLite 迁移、崩溃恢复和容量测试 | E5-08、E10-08 | 升级失败可回滚，异常退出可恢复 |
| E11-05 | P0 | M | 完成中英文、主题、窄窗口和可访问性回归 | E1-09、E2-08 | 两种语言/主题下无阻塞性问题 |
| E11-06 | P0 | M | 建立冷启动、Monaco lazy load、插件激活性能基线 | M2～M4 | 指标可重复采集，不因 Monaco 阻塞首屏 |
| E11-07 | P0 | L | 配置 Tauri 三平台安装包与签名入口 | E0-07 | 生成 Windows、macOS、Linux 可安装产物 |
| E11-08 | P0 | M | 完成安装、升级、卸载和数据保留测试 | E11-07 | 行为符合平台预期，用户数据策略明确 |
| E11-09 | P0 | M | 编写用户文档、隐私说明、运行代码风险说明 | M2～M4 | 中英文文档随发布产物提供 |
| E11-10 | P0 | S | 执行 MVP 发布检查表并冻结 Plugin API v1 最小面 | E11-01～09 | 所有阻塞问题关闭并形成发布候选版本 |

## 16. 首个可交付纵向切片

第一轮开发不要同时铺开五个插件。建议用以下最小任务集合完成第一个可演示版本：

1. `E0-01`～`E0-05`：工程可开发、可测试。
2. `E1-01`～`E1-04`：App Shell 和 Java 页面骨架。
3. `E2-01`～`E2-03`：中英文基础与切换。
4. `E3-01`～`E3-07`：Java Runner 可作为内置插件激活。
5. `E4-01`～`E4-08`：受控 IPC 和 `process.java` 权限。
6. `E5-01`～`E5-06`：设置、snippet、history 可持久化。
7. `E6-01`～`E6-11`：JDK/JBang、运行、输出、停止、历史闭环。
8. `E7-01`～`E7-09`：用户可编辑、运行和查看结果。

演示脚本：

```text
启动 DevBox
→ 切换中文/英文
→ 打开 Java Runner
→ 自动探测 JDK/JBang
→ 编辑 Main.java
→ Run
→ 查看流式 stdout/stderr
→ Stop 或等待完成
→ 查看 execution history
→ 重启应用确认设置与历史恢复
```

该切片通过后再进入 JSON/Timestamp/SQL 与 HTTP Client，可以最大限度提前暴露 IPC、权限、进程、SQLite、Monaco 和跨平台问题。

## 17. 建议的迭代切分

以下以两周迭代为例，实际容量由团队人数重新估算：

| 迭代 | 建议范围 | 可演示成果 |
|---|---|---|
| Sprint 1 | E0、E1-01～04、E2-01～02 | 可启动的双语 App Shell |
| Sprint 2 | E3、E4-01～05、E5-01～04 | 插件激活、受控 IPC、设置持久化 |
| Sprint 3 | E4-06～09、E6-01～07 | Java 环境探测与基础执行 |
| Sprint 4 | E6-08～12、E7 | 完整 Java Runner 纵向切片 |
| Sprint 5 | E8、E10-04～07 | 三个纯 UI 插件与设置/插件管理 |
| Sprint 6 | E9、E10-01～03 | HTTP Client、权限、日志与诊断 |
| Sprint 7 | E10-08～09、E11 | 稳定性、安全、双语、三平台发布 |

如果只有一名全职开发者，应优先按里程碑串行交付，并将 P1/P2 体验项延后；不可压缩权限校验、进程停止、输出背压、数据库迁移和错误脱敏。

## 18. MVP 发布检查表

- [ ] Windows、macOS、Linux 均能安装、启动、升级和卸载。
- [ ] App Shell、设置和五个插件均支持 `zh-CN` / `en-US` 即时切换。
- [ ] JSON、Timestamp、SQL 的核心输入输出和错误路径通过测试。
- [ ] Java Runner 支持 JBang/javac、JDK 选择、流式输出、Stop、timeout 和 history。
- [ ] Stop/timeout 会终止整个进程树，且只产生一个终态事件。
- [ ] HTTP Client 的 host/method allowlist、响应限制和敏感信息脱敏有效。
- [ ] 未授权插件无法调用 Java、文件或网络能力。
- [ ] SQLite migration、revision 冲突和异常退出恢复通过测试。
- [ ] 大输出、长文案、窄窗口和 Monaco lazy load 不造成阻塞性问题。
- [ ] 日志与诊断包不包含 token、密码、Cookie、环境变量或用户源码正文。
- [ ] 无 P0/P1 阻塞缺陷；发布说明和风险说明提供中英文版本。
