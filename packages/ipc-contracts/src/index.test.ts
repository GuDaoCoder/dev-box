import { describe, expect, it } from "vitest";

import { API_VERSION, createEnvelope, isDevBoxError } from "./index";

describe("IPC contracts", () => {
  it("创建带版本和请求标识的 envelope", () => {
    const envelope = createEnvelope("devbox.core", { value: 1 });

    expect(envelope.apiVersion).toBe(API_VERSION);
    expect(envelope.pluginId).toBe("devbox.core");
    expect(envelope.requestId).toHaveLength(36);
  });

  it("识别结构化 DevBox 错误", () => {
    expect(
      isDevBoxError({
        code: "INVALID_ARGUMENT",
        messageKey: "errors.invalidArgument",
        correlationId: "request-1",
        retryable: false,
      }),
    ).toBe(true);
  });
});
