import { describe, expect, it } from "vitest";

import i18n from "../i18n";

import { hostErrorMessage } from "./errors";

describe("hostErrorMessage", () => {
  it("优先显示宿主返回的具体原因", () => {
    expect(
      hostErrorMessage({
        code: "internal",
        message: "fallback",
        details: { reason: "插件窗口创建失败" },
      }),
    ).toBe("插件窗口创建失败");
  });

  it("不会把结构化错误显示成对象字符串", () => {
    expect(hostErrorMessage({ code: "not_found", message: "plugin view" })).toBe("plugin view");
  });

  it("把宿主错误键转换为当前语言提示", () => {
    expect(hostErrorMessage({ code: "NOT_FOUND", messageKey: "errors:NOT_FOUND" })).toBe(
      i18n.t("errors:NOT_FOUND"),
    );
  });
});
