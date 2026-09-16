import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("激活内置插件并显示统一的应用壳层", async () => {
    render(<App />);

    expect(screen.getByText("DevBox")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "The foundation is connected." })).toBeVisible(),
    );
    expect(screen.getByText("1 plugin active")).toBeVisible();
  });

  it("使用快捷键打开命令面板", async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeVisible();
  });
});
