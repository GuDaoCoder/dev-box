import { lazy } from "react";

// XML 与 SQL 页面只在首次打开功能标签时加载。
export const XmlToolView = lazy(() =>
  import("./StructuredTools").then((module) => ({ default: module.XmlToolView })),
);

export const SqlToolView = lazy(() =>
  import("./StructuredTools").then((module) => ({ default: module.SqlToolView })),
);
