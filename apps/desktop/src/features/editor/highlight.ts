import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// 文本编辑器与结构化工具共用同一套语义色，实际颜色由深浅主题 token 决定。
export const codeHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--editor-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--editor-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--editor-number)" },
  { tag: [tags.comment, tags.meta], color: "var(--editor-comment)" },
  { tag: [tags.heading, tags.strong], color: "var(--editor-heading)", fontWeight: "bold" },
  { tag: [tags.tagName, tags.attributeName, tags.propertyName], color: "var(--editor-property)" },
]);
