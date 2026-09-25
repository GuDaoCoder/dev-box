import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, type LanguageSupport } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import { codeHighlight } from "../editor/highlight";
import type { SqlDialect } from "./sql";

export type HighlightLanguage = "json" | "xml" | "sql";

async function loadLanguage(language: HighlightLanguage, dialect: SqlDialect) {
  if (language === "json") return (await import("@codemirror/lang-json")).json();
  if (language === "xml") return (await import("@codemirror/lang-xml")).xml();

  const sqlLanguage = await import("@codemirror/lang-sql");
  const dialects = {
    sql: sqlLanguage.StandardSQL,
    mysql: sqlLanguage.MySQL,
    postgresql: sqlLanguage.PostgreSQL,
    transactsql: sqlLanguage.MSSQL,
    plsql: sqlLanguage.PLSQL,
  };
  return sqlLanguage.sql({ dialect: dialects[dialect] });
}

export function HighlightedText({
  label,
  language,
  dialect = "sql",
  value,
  onChange,
  readOnly = false,
  wrap,
}: {
  label: string;
  language: HighlightLanguage;
  dialect?: SqlDialect;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  wrap: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const languageCompartment = useRef(new Compartment());
  const wrapCompartment = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxHighlighting(codeHighlight),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          "aria-label": label,
          "aria-multiline": "true",
          "aria-readonly": String(readOnly),
          role: "textbox",
          spellcheck: "false",
          tabindex: "0",
        }),
        languageCompartment.current.of([]),
        wrapCompartment.current.of(wrap ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // 文档由下面的同步 effect 更新；重建视图会丢失光标和撤销历史。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wrapCompartment.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }, [wrap]);

  useEffect(() => {
    viewRef.current?.contentDOM.setAttribute("aria-label", label);
  }, [label]);

  useEffect(() => {
    let active = true;
    void loadLanguage(language, dialect)
      .then((support: LanguageSupport) => {
        const view = viewRef.current;
        if (active && view) {
          view.dispatch({ effects: languageCompartment.current.reconfigure(support) });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [language, dialect]);

  return <div className="tool-code-host" ref={hostRef} />;
}
