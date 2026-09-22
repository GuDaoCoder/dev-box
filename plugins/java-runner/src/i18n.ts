export type Locale = "en-US" | "zh-CN";

const messages = {
  "zh-CN": {
    eyebrow: "JAVA · JSHELL",
    title: "Java 代码片段",
    runtime: "JDK {{version}} · JShell",
    runtimeMissing: "未检测到 JDK 11+",
    editor: "代码",
    output: "结果",
    loadingEditor: "加载中…",
    run: "运行",
    running: "运行中…",
    clear: "清空结果",
    ready: "就绪",
    unavailable: "Java 运行不可用，编辑功能仍可使用。",
    hostError: "执行失败，请重试。",
    outputTruncated: "输出已截断（256 KiB）。",
    invalid: "请输入代码。",
    elapsed: "{{value}} ms",
    exitCode: "退出码 {{value}}",
    timedOut: "超时",
    failed: "失败",
    success: "完成",
  },
  "en-US": {
    eyebrow: "JAVA · JSHELL",
    title: "Java Snippets",
    runtime: "JDK {{version}} · JShell",
    runtimeMissing: "JDK 11+ not detected",
    editor: "Code",
    output: "Output",
    loadingEditor: "Loading…",
    run: "Run",
    running: "Running…",
    clear: "Clear output",
    ready: "Ready",
    unavailable: "Java execution is unavailable. Editing remains available.",
    hostError: "Execution failed. Try again.",
    outputTruncated: "Output truncated at 256 KiB.",
    invalid: "Enter code.",
    elapsed: "{{value}} ms",
    exitCode: "Exit code {{value}}",
    timedOut: "Timed out",
    failed: "Failed",
    success: "Completed",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en-US"];

export function detectLocale(
  language = window.__DEVBOX_PLUGIN__?.locale ?? navigator.language,
): Locale {
  return language.toLocaleLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function translate(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string | number>,
) {
  let message: string = messages[locale][key];
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replace(`{{${name}}}`, String(value));
  }
  return message;
}
