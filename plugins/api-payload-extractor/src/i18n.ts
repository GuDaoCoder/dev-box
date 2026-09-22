import type { SupportedLocale } from "@devbox/plugin-sdk";

export type Locale = SupportedLocale;

const messages = {
  "zh-CN": {
    eyebrow: "PICC · API",
    title: "API报文提取",
    extract: "提取",
    clear: "清空",
    input: "日志报文",
    output: "入参",
    copy: "复制",
    copied: "已复制",
    empty: "请输入日志报文。",
    invalidLog: "未找到有效的 JSON 日志。",
    bodyMissing: "未找到 request.body。",
    plainText: "入参不是有效的 JSON 或 XML，已保留原文。",
    json: "JSON",
    xml: "XML",
    text: "文本",
  },
  "en-US": {
    eyebrow: "PICC · API",
    title: "API Payload Extractor",
    extract: "Extract",
    clear: "Clear",
    input: "Log message",
    output: "Payload",
    copy: "Copy",
    copied: "Copied",
    empty: "Enter a log message.",
    invalidLog: "No valid JSON log found.",
    bodyMissing: "request.body was not found.",
    plainText: "The payload is not valid JSON or XML. Original text is shown.",
    json: "JSON",
    xml: "XML",
    text: "Text",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en-US"];

export function detectLocale(
  language = window.__DEVBOX_PLUGIN__?.locale ?? navigator.language,
): Locale {
  return language.toLocaleLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function translate(locale: Locale, key: MessageKey) {
  return messages[locale][key];
}
