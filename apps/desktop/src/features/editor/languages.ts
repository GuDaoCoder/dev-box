import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";

// 只列入设计文档要求的文本格式；语言实现会在首次打开对应文件时加载。
const supportedLanguages = [
  LanguageDescription.of({
    name: "SQL",
    extensions: ["sql"],
    load: () => import("@codemirror/lang-sql").then((module) => module.sql()),
  }),
  LanguageDescription.of({
    name: "Markdown",
    extensions: ["md", "markdown"],
    load: () => import("@codemirror/lang-markdown").then((module) => module.markdown()),
  }),
  LanguageDescription.of({
    name: "Java",
    extensions: ["java"],
    load: () => import("@codemirror/lang-java").then((module) => module.java()),
  }),
  LanguageDescription.of({
    name: "JSON",
    extensions: ["json"],
    load: () => import("@codemirror/lang-json").then((module) => module.json()),
  }),
  LanguageDescription.of({
    name: "XML",
    extensions: ["xml"],
    load: () => import("@codemirror/lang-xml").then((module) => module.xml()),
  }),
  LanguageDescription.of({
    name: "YAML",
    extensions: ["yaml", "yml"],
    load: () => import("@codemirror/lang-yaml").then((module) => module.yaml()),
  }),
  LanguageDescription.of({
    name: "JavaScript",
    extensions: ["js", "jsx", "mjs", "cjs"],
    load: () =>
      import("@codemirror/lang-javascript").then((module) => module.javascript({ jsx: true })),
  }),
  LanguageDescription.of({
    name: "TypeScript",
    extensions: ["ts", "tsx", "mts", "cts"],
    load: () =>
      import("@codemirror/lang-javascript").then((module) =>
        module.javascript({ typescript: true, jsx: true }),
      ),
  }),
  LanguageDescription.of({
    name: "HTML",
    extensions: ["html", "htm"],
    load: () => import("@codemirror/lang-html").then((module) => module.html()),
  }),
  LanguageDescription.of({
    name: "CSS",
    extensions: ["css"],
    load: () => import("@codemirror/lang-css").then((module) => module.css()),
  }),
  LanguageDescription.of({
    name: "Properties",
    extensions: ["properties"],
    load: () =>
      import("@codemirror/legacy-modes/mode/properties").then(
        (module) => new LanguageSupport(StreamLanguage.define(module.properties)),
      ),
  }),
  LanguageDescription.of({
    name: "Shell",
    extensions: ["sh", "bash"],
    load: () =>
      import("@codemirror/legacy-modes/mode/shell").then(
        (module) => new LanguageSupport(StreamLanguage.define(module.shell)),
      ),
  }),
  LanguageDescription.of({
    name: "TOML",
    extensions: ["toml"],
    load: () =>
      import("@codemirror/legacy-modes/mode/toml").then(
        (module) => new LanguageSupport(StreamLanguage.define(module.toml)),
      ),
  }),
];

export function languageFor(name: string): LanguageDescription | null {
  if (/\.(txt|log)$/i.test(name)) return null;
  return LanguageDescription.matchFilename(supportedLanguages, name.toLowerCase());
}
