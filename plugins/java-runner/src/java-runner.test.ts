import { describe, expect, it } from "vitest";

import { detectLocale } from "./i18n";
import {
  createExecutionRequest,
  DEFAULT_TIMEOUT_MS,
  formatHostError,
  getJavaEnvironment,
  getJavaRunnerAPI,
  MAX_OUTPUT_BYTES,
  MAX_SNIPPET_BYTES,
} from "./java-runner";

describe("Java 执行协议", () => {
  it("识别宿主提供的中英文语言", () => {
    expect(detectLocale("zh-CN")).toBe("zh-CN");
    expect(detectLocale("en-US")).toBe("en-US");
  });

  it("规范化合法代码片段并设置资源上限", () => {
    expect(createExecutionRequest("  int answer = 42;\r\nanswer;  ")).toEqual({
      source: "int answer = 42;\nanswer;",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
  });

  it("拒绝空内容和超大代码片段", () => {
    expect(() => createExecutionRequest("   ")).toThrow("EMPTY_SNIPPET");
    expect(() => createExecutionRequest("a".repeat(MAX_SNIPPET_BYTES + 1))).toThrow(
      "SNIPPET_TOO_LARGE",
    );
  });

  it("宿主未注入能力时不伪造运行结果", () => {
    expect(getJavaRunnerAPI({})).toBeUndefined();
  });

  it("从 DevBox 插件桥接中获取 Java 执行能力", () => {
    const execute = () =>
      Promise.resolve({
        status: "success" as const,
        stdout: "42\n",
        stderr: "",
        exitCode: 0,
        durationMs: 10,
        truncated: false,
      });
    expect(getJavaRunnerAPI({ __DEVBOX_PLUGIN_API__: { java: { execute } } })).toEqual({ execute });
  });

  it("读取宿主检测到的 JDK 版本", () => {
    expect(
      getJavaEnvironment({
        __DEVBOX_PLUGIN__: { java: { version: "11.0.26", majorVersion: 11 } },
      }),
    ).toEqual({ version: "11.0.26", majorVersion: 11 });
  });

  it("优先显示宿主返回的错误原因", () => {
    expect(formatHostError({ details: { reason: "没有找到 JShell" } })).toBe("没有找到 JShell");
    expect(formatHostError({ code: "INTERNAL" })).toBeUndefined();
  });
});
