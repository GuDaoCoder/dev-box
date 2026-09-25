import { describe, expect, it } from "vitest";

import { SQL_INPUT_LIMIT, transformSql } from "./sql";
import { XML_INPUT_LIMIT, transformXml } from "./xml";

describe("XML 工具", () => {
  it("格式化与压缩元素结构，并保留声明、属性、命名空间和注释", () => {
    const input = '<?xml version="1.0"?><root xmlns:x="urn:x"><x:item id="1"/><!-- note --></root>';
    const formatted = transformXml(input, { compact: false, indent: 2 }).output;
    expect(formatted).toBe(
      '<?xml version="1.0"?>\n<root xmlns:x="urn:x">\n  <x:item id="1"/>\n  <!-- note -->\n</root>',
    );
    expect(transformXml(formatted ?? "", { compact: true, indent: 2 }).output).toBe(input);
  });

  it("不改写混合文本、CDATA 和 xml:space 子树", () => {
    const input =
      '<root><p>Hello <b>world</b>!</p><code xml:space="preserve"> a  b </code><![CDATA[ a < b ]]></root>';
    const output = transformXml(input, { compact: false, indent: 2 }).output;
    expect(output).toContain("<p>Hello <b>world</b>!</p>");
    expect(output).toContain('<code xml:space="preserve"> a  b </code>');
    expect(output).toContain("<![CDATA[ a < b ]]>");
  });

  it("校验非法 XML，拒绝 DTD 和超限输入", () => {
    expect(transformXml("<a>", { compact: false, indent: 2 }).error).toBe("INVALID_XML");
    expect(transformXml("<!DOCTYPE x><x/>", { compact: false, indent: 2 }).error).toBe(
      "UNSAFE_DTD",
    );
    expect(transformXml("x".repeat(XML_INPUT_LIMIT + 1), { compact: false, indent: 2 }).error).toBe(
      "INPUT_TOO_LARGE",
    );
    expect(transformXml("<a/>", { compact: false, indent: 2, validateOnly: true })).toEqual({});
  });
});

describe("SQL 工具", () => {
  it("按方言和关键字大小写格式化，不改写字符串和注释", () => {
    const result = transformSql("select 'from x' as label -- keep\nfrom users", {
      dialect: "postgresql",
      keywordCase: "upper",
      indent: 2,
    });
    expect(result.output).toContain("SELECT");
    expect(result.output).toContain("FROM\n  users");
    expect(result.output).toContain("'from x'");
    expect(result.output).toContain("-- keep");
  });

  it("不将格式化误当作语法校验，并限制输入大小", () => {
    expect(
      transformSql("select from", { dialect: "sql", keywordCase: "preserve", indent: 4 }).output,
    ).toBeDefined();
    expect(
      transformSql("x".repeat(SQL_INPUT_LIMIT + 1), {
        dialect: "sql",
        keywordCase: "preserve",
        indent: 2,
      }).error,
    ).toBe("INPUT_TOO_LARGE");
  });
});
