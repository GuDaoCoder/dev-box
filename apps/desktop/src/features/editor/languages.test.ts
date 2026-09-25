import { describe, expect, it } from "vitest";
import { languageFor } from "./languages";

describe("文本编辑器语言识别", () => {
  it.each([
    ["query.SQL", "SQL"],
    ["README.md", "Markdown"],
    ["Demo.java", "Java"],
    ["data.json", "JSON"],
    ["config.XML", "XML"],
    ["app.yml", "YAML"],
    ["app.yaml", "YAML"],
    ["messages.properties", "Properties"],
    ["script.ts", "TypeScript"],
    ["site.html", "HTML"],
    ["style.css", "CSS"],
    ["config.toml", "TOML"],
  ])("识别 %s", (filename, expected) => {
    expect(languageFor(filename)?.name).toBe(expected);
  });

  it("未知文件与日志使用纯文本", () => {
    expect(languageFor("unknown.custom")).toBeNull();
    expect(languageFor("app.log")).toBeNull();
  });
});
