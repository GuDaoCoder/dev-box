import { lazy } from "react";

// 文本编辑器只在首次打开功能标签时加载，不增加其他内置工具的启动体积。
export const LazyTextEditorView = lazy(() =>
  import("./TextEditorView").then((module) => ({ default: module.TextEditorView })),
);
