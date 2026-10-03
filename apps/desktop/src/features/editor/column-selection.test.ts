import { fireEvent } from "@testing-library/react";
import { deleteCharBackward, undo } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { afterEach, describe, expect, it, vi } from "vitest";

import { columnSelection, isColumnSelectionShortcut } from "./column-selection";

let view: EditorView | undefined;
afterEach(() => {
  view?.destroy();
  view = undefined;
});

function createEditor(content: string, position = 0) {
  view = new EditorView({
    state: EditorState.create({
      doc: content,
      selection: { anchor: position },
      extensions: [basicSetup, columnSelection(() => {})],
    }),
  });
  return view;
}

function extend(editor: EditorView, key: string) {
  fireEvent.keyDown(editor.contentDOM, { key, shiftKey: true });
}

function selectedText(editor: EditorView) {
  return editor.state.selection.ranges.map((range) => editor.state.sliceDoc(range.from, range.to));
}

describe("列选择", () => {
  it("方向键形成矩形，输入及删除同时作用于每行并可一次撤销", () => {
    const editor = createEditor("abc\ndef\nghi", 1);
    extend(editor, "ArrowDown");
    extend(editor, "ArrowDown");
    extend(editor, "ArrowRight");
    expect(selectedText(editor)).toEqual(["b", "e", "h"]);
    editor.dispatch({ ...editor.state.replaceSelection("X"), userEvent: "input.type" });
    expect(editor.state.doc.toString()).toBe("aXc\ndXf\ngXi");
    expect(undo(editor)).toBe(true);
    expect(editor.state.doc.toString()).toBe("abc\ndef\nghi");
    expect(selectedText(editor)).toEqual(["b", "e", "h"]);
    expect(deleteCharBackward(editor)).toBe(true);
    expect(editor.state.doc.toString()).toBe("ac\ndf\ngi");
    expect(undo(editor)).toBe(true);
    expect(editor.state.doc.toString()).toBe("abc\ndef\nghi");
  });

  it("反向扩展及缩小保持固定起点，短行与空行不补空格", () => {
    const editor = createEditor("abcd\nx\n\nefgh", 3);
    extend(editor, "ArrowLeft");
    extend(editor, "ArrowLeft");
    extend(editor, "ArrowDown");
    extend(editor, "ArrowDown");
    extend(editor, "ArrowDown");
    expect(selectedText(editor)).toEqual(["bc", "", "", "fg"]);
    extend(editor, "ArrowUp");
    expect(selectedText(editor)).toEqual(["bc", "", ""]);
    extend(editor, "ArrowUp");
    extend(editor, "ArrowUp");
    expect(selectedText(editor)).toEqual(["bc"]);
    expect(editor.state.doc.toString()).toBe("abcd\nx\n\nefgh");
  });

  it("Tab 按显示列对齐，重新定位后使用新起点且文档边界不会越界", () => {
    const editor = createEditor("\tabc\n1234xyz", 1);
    extend(editor, "ArrowDown");
    extend(editor, "ArrowRight");
    expect(selectedText(editor)).toEqual(["a", "x"]);
    editor.dispatch({ selection: { anchor: 0 } });
    extend(editor, "ArrowUp");
    extend(editor, "ArrowLeft");
    expect(editor.state.selection.ranges).toHaveLength(1);
    expect(editor.state.selection.main.head).toBe(0);
    extend(editor, "ArrowDown");
    extend(editor, "ArrowDown");
    expect(editor.state.selection.ranges).toHaveLength(2);
  });

  it("只读预览仍能矩形选择，但删除操作不会改动正文", () => {
    view = new EditorView({
      state: EditorState.create({
        doc: "abc\ndef",
        extensions: [basicSetup, EditorState.readOnly.of(true), columnSelection(() => {})],
      }),
    });
    extend(view, "ArrowDown");
    extend(view, "ArrowRight");
    expect(selectedText(view)).toEqual(["a", "d"]);
    expect(deleteCharBackward(view)).toBe(false);
    expect(view.state.doc.toString()).toBe("abc\ndef");
  });

  it("切换快捷键按平台判断，macOS 按物理数字键兼容 Shift 字符", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Macintosh");
    expect(
      isColumnSelectionShortcut(
        new KeyboardEvent("keydown", { key: "*", code: "Digit8", metaKey: true, shiftKey: true }),
      ),
    ).toBe(true);
    expect(
      isColumnSelectionShortcut(
        new KeyboardEvent("keydown", { key: "Insert", altKey: true, shiftKey: true }),
      ),
    ).toBe(false);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Windows");
    expect(
      isColumnSelectionShortcut(
        new KeyboardEvent("keydown", { key: "Insert", altKey: true, shiftKey: true }),
      ),
    ).toBe(true);
    vi.restoreAllMocks();
  });
});
