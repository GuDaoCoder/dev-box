import { describe, expect, it } from "vitest";

import {
  JSON_INPUT_LIMIT,
  generateUuids,
  hashText,
  formatInTimeZone,
  parseTimestamp,
  textStats,
  transformEncoding,
  transformJson,
} from "./algorithms";

describe("内置工具算法", () => {
  it("格式化并递归排序 JSON 对象键", () => {
    expect(
      transformJson('{"z":1,"nested":{"b":2,"a":1}}', {
        compact: false,
        sortKeys: true,
      }).output,
    ).toBe('{\n  "nested": {\n    "a": 1,\n    "b": 2\n  },\n  "z": 1\n}');
  });

  it("报告 JSON 错误位置", () => {
    const result = transformJson('{\n  "value":\n}', { compact: false, sortKeys: false });
    expect(result.error?.line).toBe(3);
    expect(result.error?.column).toBe(1);
  });

  it("限制超过 2 MiB 的 JSON 输入", () => {
    const result = transformJson(`"${"x".repeat(JSON_INPUT_LIMIT)}"`, {
      compact: false,
      sortKeys: false,
    });
    expect(result.error?.message).toBe("INPUT_TOO_LARGE");
  });

  it("识别秒级和毫秒级时间戳", () => {
    expect(parseTimestamp("0").milliseconds).toBe(0);
    expect(parseTimestamp("1700000000000").seconds).toBe(1_700_000_000);
  });

  it("支持负数、ISO 日期和 IANA 时区夏令时", () => {
    expect(parseTimestamp("-1").milliseconds).toBe(-1000);
    expect(parseTimestamp("2024-01-01T00:00:00Z").seconds).toBe(1_704_067_200);
    expect(
      formatInTimeZone(Date.parse("2024-01-01T12:00:00Z"), "America/New_York", "en-US"),
    ).toContain("07:00:00");
    expect(
      formatInTimeZone(Date.parse("2024-07-01T12:00:00Z"), "America/New_York", "en-US"),
    ).toContain("08:00:00");
    expect(() => parseTimestamp("not-a-date")).toThrow("INVALID_TIME");
  });

  it.each(["base64", "url", "hex"] as const)("%s 支持 Unicode 往返", (mode) => {
    const value = "DevBox 开发工具";
    const encoded = transformEncoding(value, mode, "encode");
    expect(transformEncoding(encoded, mode, "decode")).toBe(value);
  });

  it("编码符合标准向量并拒绝非法输入", () => {
    expect(transformEncoding("", "base64", "encode")).toBe("");
    expect(transformEncoding("DevBox", "base64", "encode")).toBe("RGV2Qm94");
    expect(transformEncoding("a b", "url", "encode")).toBe("a%20b");
    expect(transformEncoding("ABC", "hex", "encode")).toBe("414243");
    expect(() => transformEncoding("%%%", "base64", "decode")).toThrow("INVALID_BASE64");
    expect(() => transformEncoding("f", "hex", "decode")).toThrow("INVALID_HEX");
    expect(() => transformEncoding("%E0%A4%A", "url", "decode")).toThrow("INVALID_URL");
  });

  it("生成 UUID 并按 Unicode 字符统计文本", () => {
    const values = generateUuids(3);
    expect(values).toHaveLength(3);
    for (const value of values) {
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }
    expect(() => generateUuids(0)).toThrow("INVALID_COUNT");
    expect(() => generateUuids(1001)).toThrow("INVALID_COUNT");
    expect(textStats("A😀")).toEqual({ characters: 2, bytes: 5 });
  });

  it("计算标准 SHA-2 摘要并支持大文本", async () => {
    await expect(hashText("abc", "SHA-256", "hex")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    await expect(hashText("", "SHA-384", "hex")).resolves.toHaveLength(96);
    await expect(hashText("你好", "SHA-512", "base64")).resolves.toMatch(/^[A-Za-z0-9+/]+=*$/);
    await expect(hashText("x".repeat(1024 * 1024), "SHA-256", "hex")).resolves.toHaveLength(64);
  });
});
