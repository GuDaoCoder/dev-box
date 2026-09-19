import { beforeEach, describe, expect, it } from "vitest";

import { useAppStore } from "./app-store";

describe("工作区标签状态", () => {
  beforeEach(() => {
    useAppStore.setState({ activeTabId: "tool.json", tabs: ["tool.json"] });
  });

  it("重复打开同一功能时只保留一个标签", () => {
    useAppStore.getState().openTab("tool.timestamp");
    useAppStore.getState().openTab("tool.timestamp");

    expect(useAppStore.getState().tabs).toEqual(["tool.json", "tool.timestamp"]);
    expect(useAppStore.getState().activeTabId).toBe("tool.timestamp");
  });

  it("关闭活动标签后激活相邻标签", () => {
    useAppStore.setState({
      activeTabId: "tool.timestamp",
      tabs: ["tool.json", "tool.timestamp", "tool.encoding"],
    });

    useAppStore.getState().closeTab("tool.timestamp");

    expect(useAppStore.getState().tabs).toEqual(["tool.json", "tool.encoding"]);
    expect(useAppStore.getState().activeTabId).toBe("tool.encoding");
  });

  it("按目标位置重新排序标签", () => {
    useAppStore.setState({
      activeTabId: "tool.encoding",
      tabs: ["tool.json", "tool.timestamp", "tool.encoding"],
    });

    useAppStore.getState().reorderTab("tool.encoding", "tool.json");

    expect(useAppStore.getState().tabs).toEqual(["tool.encoding", "tool.json", "tool.timestamp"]);
  });
});
