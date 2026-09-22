# 发布检查表

- [x] `plugin.json` 版本、DevBox 兼容范围和 Plugin API 兼容范围正确。
- [x] 中文与英文标题、界面和文档已同步。
- [x] `pnpm check` 通过。
- [x] `pnpm package:zip` 连续运行两次得到相同 SHA-256。
- [x] DevBox 预检展示正确名称、版本、未签名状态、SHA-256 和 `java:execute` 风险。
- [x] 安装、启用、打开、禁用、重新启用和卸载流程通过。
- [x] 正常输出、语法错误、运行异常、死循环超时和输出截断通过。
- [x] `Command/Ctrl + Enter`、Tab 焦点和中英文界面通过。
- [ ] 在 macOS、Windows、Linux 各自安装 JDK 11 后完成最低版本实机冒烟。
- [ ] 发布 ZIP 与 SHA-256 一并交付；正式公开分发前评估 Ed25519 签名。
