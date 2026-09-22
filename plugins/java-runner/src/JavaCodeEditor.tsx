import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { java } from "@codemirror/lang-java";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";

const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: "var(--text)",
      backgroundColor: "transparent",
      fontSize: "14px",
    },
    ".cm-content": {
      padding: "16px 0 40px",
      caretColor: "var(--accent)",
      fontFamily: "var(--font-code)",
      lineHeight: "1.65",
    },
    ".cm-gutters": {
      border: "0",
      color: "var(--text-dim)",
      backgroundColor: "transparent",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--accent) 7%, transparent)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
    },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

export function JavaCodeEditor({
  value,
  onChange,
  onRun,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const initialValue = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
    onRunRef.current = onRun;
  }, [onChange, onRun]);

  useEffect(() => {
    if (!container.current) return;
    const state = EditorState.create({
      doc: initialValue.current,
      extensions: [
        lineNumbers(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        java(),
        editorTheme,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Enter",
            run: () => {
              onRunRef.current();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: container.current });
    return () => view.destroy();
  }, []);

  return <div aria-label="Java code editor" className="code-editor" ref={container} />;
}

export default JavaCodeEditor;
