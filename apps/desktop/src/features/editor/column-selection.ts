import {
  countColumn,
  EditorSelection,
  findColumn,
  Prec,
  StateEffect,
  StateField,
  type EditorState,
} from "@codemirror/state";
import { EditorView, keymap, rectangularSelection, type Command } from "@codemirror/view";

type Corner = { line: number; column: number };
type Rectangle = { anchor: Corner; head: Corner };

const setRectangle = StateEffect.define<Rectangle>();
const rectangle = StateField.define<Rectangle | null>({
  create: () => null,
  update(value, transaction) {
    // 普通选择或编辑后重新确定起点，避免沿用上一次框选的坐标。
    if (transaction.docChanged || transaction.selection) value = null;
    for (const effect of transaction.effects) {
      if (effect.is(setRectangle)) value = effect.value;
    }
    return value;
  },
});

function cornerAt(state: EditorState, position: number): Corner {
  const line = state.doc.lineAt(position);
  return {
    line: line.number,
    column: countColumn(line.text, state.tabSize, position - line.from),
  };
}

function extendRectangle(lineDelta: number, columnDelta: number): Command {
  return (view) => {
    const { state } = view;
    const ranges = state.selection.ranges;
    const previous = state.field(rectangle) ?? {
      anchor: cornerAt(state, ranges[0]!.anchor),
      head: cornerAt(state, ranges[ranges.length - 1]!.head),
    };
    const next: Rectangle = {
      anchor: previous.anchor,
      head: {
        line: Math.max(1, Math.min(state.doc.lines, previous.head.line + lineDelta)),
        column: Math.max(0, previous.head.column + columnDelta),
      },
    };
    const startLine = Math.min(next.anchor.line, next.head.line);
    const endLine = Math.max(next.anchor.line, next.head.line);
    const selection = [];
    for (let number = startLine; number <= endLine; number++) {
      const line = state.doc.line(number);
      // 按显示列计算 Tab 的宽度；短行停在行尾，不填充空格或改动正文。
      selection.push(
        EditorSelection.range(
          line.from + findColumn(line.text, next.anchor.column, state.tabSize),
          line.from + findColumn(line.text, next.head.column, state.tabSize),
        ),
      );
    }
    view.dispatch({
      selection: EditorSelection.create(selection, next.head.line - startLine),
      effects: setRectangle.of(next),
      scrollIntoView: true,
      userEvent: "select.keyboard",
    });
    return true;
  };
}

export function columnSelection(onExit: () => void) {
  return [
    rectangle,
    EditorView.editorAttributes.of({ class: "cm-column-selection" }),
    Prec.highest(rectangularSelection({ eventFilter: (event) => event.button === 0 })),
    Prec.highest(
      keymap.of([
        { key: "Shift-ArrowUp", run: extendRectangle(-1, 0) },
        { key: "Shift-ArrowDown", run: extendRectangle(1, 0) },
        { key: "Shift-ArrowLeft", run: extendRectangle(0, -1) },
        { key: "Shift-ArrowRight", run: extendRectangle(0, 1) },
        {
          key: "Escape",
          run: () => {
            onExit();
            return true;
          },
        },
      ]),
    ),
  ];
}

export function isColumnSelectionShortcut(event: KeyboardEvent) {
  const mac = /Mac|iPhone|iPad/i.test(navigator.userAgent);
  return mac
    ? event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey && event.code === "Digit8"
    : event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey && event.key === "Insert";
}

export function columnSelectionShortcutLabel() {
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘ ⇧ 8" : "Alt Shift Insert";
}
