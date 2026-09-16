import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the M0 engineering baseline", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "The foundation is ready." })).toBeVisible();
    expect(screen.getByText("Tauri 2 + Rust")).toBeVisible();
    expect(screen.getByText("v0.1.0")).toBeVisible();
  });
});
