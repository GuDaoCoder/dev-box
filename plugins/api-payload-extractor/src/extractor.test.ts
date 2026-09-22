import { describe, expect, it } from "vitest";

import { ExtractionError, extractApiPayload } from "./extractor";

describe("extractApiPayload", () => {
  it("从带 response 的日志中提取并格式化 JSON 字符串", () => {
    const input = JSON.stringify({
      request: { body: JSON.stringify({ name: "PICC", items: [1, 2] }) },
      response: { status: 200 },
    });
    expect(extractApiPayload(input)).toEqual({
      format: "json",
      output: '{\n  "name": "PICC",\n  "items": [\n    1,\n    2\n  ]\n}',
    });
  });

  it("兼容原逻辑中的 reponse 拼写", () => {
    const input = JSON.stringify({ request: { body: { ok: true } }, reponse: {} });
    expect(extractApiPayload(input)).toEqual({
      format: "json",
      output: '{\n  "ok": true\n}',
    });
  });

  it("支持 Java 转义且带日志前缀的内容", () => {
    const log = JSON.stringify({ request: { body: '{\\"id\\":1}' }, response: {} });
    expect(extractApiPayload(`INFO payload=${log} finished`)).toEqual({
      format: "json",
      output: '{\n  "id": 1\n}',
    });
  });

  it("提取并格式化 XML", () => {
    const input = JSON.stringify({
      request: { body: '<?xml version="1.0"?><root><name>PICC</name><empty /></root>' },
      response: {},
    });
    expect(extractApiPayload(input)).toEqual({
      format: "xml",
      output: '<?xml version="1.0"?>\n<root>\n  <name>\n    PICC\n  </name>\n  <empty />\n</root>',
    });
  });

  it("无法格式化时保留原始 body", () => {
    const input = JSON.stringify({ request: { body: "plain text" }, response: {} });
    expect(extractApiPayload(input)).toEqual({ format: "text", output: "plain text" });
  });

  it("缺少 body 时返回明确错误", () => {
    expect(() => extractApiPayload('{"request":{},"response":{}}')).toThrowError(
      new ExtractionError("BODY_MISSING"),
    );
  });
});
