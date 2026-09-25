import { lazy } from "react";

// 工具高亮编辑器与语言包只在首次打开对应工具时加载。
export const LazyHighlightedText = lazy(() =>
  import("./HighlightedText").then((module) => ({ default: module.HighlightedText })),
);
