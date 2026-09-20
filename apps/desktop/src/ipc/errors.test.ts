import { describe, expect, it } from "vitest";

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
});
