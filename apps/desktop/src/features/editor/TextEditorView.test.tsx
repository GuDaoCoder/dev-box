import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";

import i18n from "../../i18n";
import { useAppStore } from "../../stores/app-store";
import { TextEditorView } from "./TextEditorView";
import { readEditorSession } from "./editor-session";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  openDirectory: vi.fn(),
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  saveFile: vi.fn(),
  renameFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onCloseRequested: () => Promise.resolve(() => {}), destroy: vi.fn() }),
}));
vi.mock("./editor-api", () => ({
  editorAPI: {
    openDirectory: mocks.openDirectory,
    listDirectory: mocks.listDirectory,
    readFile: mocks.readFile,
    saveFile: mocks.saveFile,
    renameFile: mocks.renameFile,
  },
}));

describe("TextEditorView", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Range.prototype.getClientRects = () => [new DOMRect(0, 0, 1, 16)] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 1, 16);
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    await i18n.changeLanguage("en-US");
    mocks.open.mockResolvedValue("/chosen");
    mocks.openDirectory.mockResolvedValue({ name: "chosen", path: "/chosen" });
    mocks.listDirectory.mockImplementation((path: string) =>
      Promise.resolve(
        path === ""
          ? [
              { name: "src", path: "src", kind: "directory", hidden: false },
              { name: "data.json", path: "data.json", kind: "file", hidden: false },
            ]
          : [{ name: "App.java", path: "src/App.java", kind: "file", hidden: false }],
      ),
    );
    mocks.readFile.mockResolvedValue({
      path: "data.json",
      content: "",
      revision: "hash",
      size: 0,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
  });

  it("首次打开为空，选择目录后按需展开树并打开文件标签", async () => {
    render(<TextEditorView />);
    expect(screen.getByText("Open a folder to browse and edit text files")).toBeVisible();
    expect(mocks.listDirectory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    await screen.findByRole("button", { name: "data.json" });
    expect(mocks.listDirectory).toHaveBeenCalledWith("");
    expect(mocks.listDirectory).not.toHaveBeenCalledWith("src");

    fireEvent.click(screen.getByRole("button", { name: "src" }));
    await screen.findByRole("button", { name: "App.java" });
    expect(mocks.listDirectory).toHaveBeenCalledWith("src");

    fireEvent.click(screen.getByRole("button", { name: "data.json" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "data.json" })).toBeVisible());
    expect(screen.getByText("JSON")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(mocks.readFile).toHaveBeenCalledWith("data.json");
  });

  it("修改文件后关闭标签会先询问，并可保存", async () => {
    mocks.saveFile.mockResolvedValue({
      path: "data.json",
      content: "changed",
      revision: "new-hash",
      size: 7,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });

    const editor = EditorView.findFromDOM(document.querySelector<HTMLElement>(".cm-editor")!);
    expect(editor).not.toBeNull();
    act(() => editor!.dispatch({ changes: { from: 0, insert: "changed" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Close data.json" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Save changes to data.json?");
    expect(useAppStore.getState().editorDialogOpen).toBe(true);
    fireEvent.click(screen.getByRole("dialog").querySelector("button.ui-button--primary")!);
    await waitFor(() =>
      expect(mocks.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: "data.json" }),
        "changed",
        false,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("tab", { name: "data.json" })).not.toBeInTheDocument(),
    );
    expect(useAppStore.getState().editorDialogOpen).toBe(false);
  });

  it("切换目录后即使读取目录失败，也不会保留旧目录的文件标签", async () => {
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });

    mocks.open.mockResolvedValueOnce("/new");
    mocks.openDirectory.mockResolvedValueOnce({ name: "new", path: "/new" });
    mocks.listDirectory.mockRejectedValueOnce("READ_FAILED");
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    await waitFor(() =>
      expect(screen.queryByRole("tab", { name: "data.json" })).not.toBeInTheDocument(),
    );
    expect(document.querySelector(".editor-page-header span")).toHaveTextContent("new");
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("外部修改时先确认再覆盖，不静默丢失磁盘内容", async () => {
    mocks.saveFile.mockRejectedValueOnce("EXTERNAL_MODIFIED").mockResolvedValueOnce({
      path: "data.json",
      content: "mine",
      revision: "new-hash",
      size: 4,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });
    act(() =>
      EditorView.findFromDOM(document.querySelector<HTMLElement>(".cm-editor")!)!.dispatch({
        changes: { from: 0, insert: "mine" },
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("File changed on disk")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    await waitFor(() =>
      expect(mocks.saveFile).toHaveBeenLastCalledWith(
        expect.objectContaining({ path: "data.json" }),
        "mine",
        true,
      ),
    );
  });

  it("只在当前文件内查找并作为一次编辑全部替换", async () => {
    mocks.readFile.mockResolvedValue({
      path: "data.json",
      content: "one one",
      revision: "hash",
      size: 7,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });

    fireEvent.keyDown(document.querySelector<HTMLElement>(".cm-content")!, {
      key: "r",
      ctrlKey: true,
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Find" }), { target: { value: "one" } });
    expect(await screen.findByText("0 / 2")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Replace" }), {
      target: { value: "two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace All" }));
    await waitFor(() =>
      expect(
        EditorView.findFromDOM(
          document.querySelector<HTMLElement>(".cm-editor")!,
        )?.state.doc.toString(),
      ).toBe("two two"),
    );
    expect(mocks.saveFile).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("编码菜单向上打开，切换编码后明确标记未保存并用新编码保存", async () => {
    mocks.saveFile.mockResolvedValue({
      path: "data.json",
      content: "",
      revision: "new-hash",
      size: 0,
      readOnly: false,
      encoding: "GBK",
      lineEnding: "LF",
    });
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });

    expect(screen.getByRole("checkbox", { name: "Word Wrap" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /UTF-8/ }));
    expect(screen.getByRole("menu", { name: "File encoding" })).toBeVisible();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "GBK" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mocks.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ encoding: "GBK" }),
        "",
        false,
      ),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
  });

  it("跳转行使用中央弹窗，支持行号和列数", async () => {
    mocks.readFile.mockResolvedValue({
      path: "data.json",
      content: "a\nbcd",
      revision: "hash",
      size: 5,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });
    fireEvent.keyDown(document.querySelector<HTMLElement>(".cm-content")!, {
      key: "g",
      ctrlKey: true,
    });
    const dialog = screen.getByRole("dialog", { name: "Go to Line" });
    expect(screen.getByPlaceholderText("line:column")).toBeVisible();
    expect(dialog.querySelector("button.ui-button--primary")).toHaveTextContent("Confirm");
    fireEvent.change(screen.getByRole("textbox", { name: "Line and column" }), {
      target: { value: "2:3" },
    });
    fireEvent.click(dialog.querySelector("button.ui-button--primary")!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go to Line" })).toBeNull());
    expect(
      EditorView.findFromDOM(document.querySelector<HTMLElement>(".cm-editor")!)!.state.selection
        .main.head,
    ).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: /Go to Line/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Line and column" }), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen
        .getByRole("dialog", { name: "Go to Line" })
        .querySelector("button.ui-button--primary")!,
    );
    expect(
      EditorView.findFromDOM(document.querySelector<HTMLElement>(".cm-editor")!)!.state.selection
        .main.head,
    ).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: /Go to Line/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Line and column" }), {
      target: { value: "999:999" },
    });
    fireEvent.click(
      screen
        .getByRole("dialog", { name: "Go to Line" })
        .querySelector("button.ui-button--primary")!,
    );
    expect(
      EditorView.findFromDOM(document.querySelector<HTMLElement>(".cm-editor")!)!.state.selection
        .main.head,
    ).toBe(5);
    expect(screen.queryByText("Invalid position")).toBeNull();
  });

  it("重新打开编辑器时恢复目录、文件标签及活动文件", async () => {
    const first = render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });
    fireEvent.click(screen.getByRole("button", { name: "src" }));
    mocks.readFile.mockResolvedValueOnce({
      path: "src/App.java",
      content: "class App {}",
      revision: "java-hash",
      size: 12,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    fireEvent.click(await screen.findByRole("button", { name: "App.java" }));
    await screen.findByRole("tab", { name: "App.java" });
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("devbox.editor.workspace.v1")!)).toEqual({
        rootPath: "/chosen",
        tabs: ["data.json", "src/App.java"],
        activePath: "src/App.java",
      }),
    );

    first.unmount();
    mocks.readFile.mockImplementation((path: string) =>
      Promise.resolve({
        path,
        content: path === "src/App.java" ? "updated on disk" : "",
        revision: "new-hash",
        size: 0,
        readOnly: false,
        encoding: "UTF-8",
        lineEnding: "LF",
      }),
    );
    render(<TextEditorView />);
    await screen.findByRole("tab", { name: "App.java" });
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "data.json",
      "App.java",
    ]);
    expect(screen.getByRole("tab", { name: "App.java" })).toHaveAttribute("aria-selected", "true");
    expect(mocks.openDirectory).toHaveBeenLastCalledWith("/chosen");
    expect(mocks.readFile).toHaveBeenCalledWith("src/App.java");
    await waitFor(() =>
      expect(
        EditorView.findFromDOM(
          document.querySelector<HTMLElement>(".cm-editor")!,
        )?.state.doc.toString(),
      ).toBe("updated on disk"),
    );
  });

  it("恢复时跳过已删除文件，并在目录失效时允许重新选择", async () => {
    window.localStorage.setItem(
      "devbox.editor.workspace.v1",
      JSON.stringify({
        rootPath: "/chosen",
        tabs: ["missing.txt", "data.json"],
        activePath: "missing.txt",
      }),
    );
    mocks.readFile.mockImplementation((path: string) =>
      path === "missing.txt"
        ? Promise.reject(new Error("NOT_FOUND"))
        : Promise.resolve({
            path,
            content: "fresh",
            revision: "hash",
            size: 5,
            readOnly: false,
            encoding: "UTF-8",
            lineEnding: "LF",
          }),
    );
    const first = render(<TextEditorView />);
    await screen.findByRole("tab", { name: "data.json" });
    expect(screen.queryByRole("tab", { name: "missing.txt" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Some files could not be reopened");
    await waitFor(() => expect(readEditorSession()?.tabs).toEqual(["data.json"]));

    first.unmount();
    mocks.openDirectory.mockRejectedValueOnce("OPEN_FAILED");
    render(<TextEditorView />);
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("Previous folder is unavailable");
    expect(screen.getByRole("button", { name: "Open Folder" })).toBeEnabled();
    expect(window.localStorage.getItem("devbox.editor.workspace.v1")).toBeNull();
  });

  it("文件标签菜单支持关闭其他和重命名", async () => {
    mocks.renameFile.mockResolvedValue({
      path: "renamed.json",
      content: "",
      revision: "hash",
      size: 0,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    render(<TextEditorView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Folder" }));
    fireEvent.click(await screen.findByRole("button", { name: "data.json" }));
    await screen.findByRole("tab", { name: "data.json" });
    fireEvent.click(screen.getByRole("button", { name: "src" }));
    mocks.readFile.mockResolvedValueOnce({
      path: "src/App.java",
      content: "",
      revision: "java-hash",
      size: 0,
      readOnly: false,
      encoding: "UTF-8",
      lineEnding: "LF",
    });
    fireEvent.click(await screen.findByRole("button", { name: "App.java" }));
    await screen.findByRole("tab", { name: "App.java" });

    fireEvent.contextMenu(screen.getByRole("tab", { name: "data.json" }), {
      clientX: 50,
      clientY: 50,
    });
    expect(screen.getByRole("menuitem", { name: "Close Current" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Close All" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Close to the Right" })).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: "Close Others" }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: "App.java" })).toBeNull());

    fireEvent.contextMenu(screen.getByRole("tab", { name: "data.json" }), {
      clientX: 50,
      clientY: 50,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    fireEvent.change(screen.getByRole("textbox", { name: "File name" }), {
      target: { value: "renamed.json" },
    });
    fireEvent.click(
      screen.getByRole("dialog", { name: "Rename" }).querySelector("button.ui-button--primary")!,
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: "renamed.json" })).toBeVisible());
    expect(mocks.renameFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: "data.json" }),
      "renamed.json",
    );
  });
});
