import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton, CopyButton } from "@devbox/ui";

import { ToolActionBar, ToolHeader } from "./BuiltinTools";
import { LazyHighlightedText } from "./LazyHighlightedText";
import { transformXml } from "./xml";
import type { SqlDialect, SqlKeywordCase } from "./sql";

function TextPanels({
  input,
  output,
  wrap,
  language,
  dialect,
  onInputChange,
}: {
  input: string;
  output: string;
  wrap: boolean;
  language: "xml" | "sql";
  dialect?: SqlDialect;
  onInputChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="tool-editor-grid">
      <article className="tool-editor">
        <div className="tool-editor-heading">
          <strong>{t("tools.common.input")}</strong>
          <small>{new TextEncoder().encode(input).byteLength.toLocaleString()} B</small>
        </div>
        <LazyHighlightedText
          dialect={dialect}
          label={t("tools.common.input")}
          language={language}
          onChange={onInputChange}
          value={input}
          wrap={wrap}
        />
      </article>
      <article className="tool-editor">
        <div className="tool-editor-heading">
          <strong>{t("tools.common.output")}</strong>
          <CopyButton copiedLabel={t("actions.copied")} label={t("actions.copy")} value={output} />
        </div>
        <LazyHighlightedText
          dialect={dialect}
          label={t("tools.common.output")}
          language={language}
          readOnly
          value={output}
          wrap={wrap}
        />
      </article>
    </div>
  );
}

export function XmlToolView() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<2 | 4>(2);
  const [wrap, setWrap] = useState(true);
  const [status, setStatus] = useState("");

  function run(compact: boolean, validateOnly = false) {
    if (!input.trim()) {
      setStatus(t("tools.xml.empty"));
      return;
    }
    const result = transformXml(input, { compact, indent, validateOnly });
    if (result.error) {
      setStatus(t(`tools.xml.errors.${result.error}`));
      return;
    }
    if (!validateOnly) setOutput(result.output ?? "");
    setStatus(validateOnly ? t("tools.xml.valid") : "");
  }

  return (
    <section className="devbox-page devbox-page--fluid tool-page tool-page--editor">
      <ToolHeader title={t("tools.xml.title")} />
      <ToolActionBar
        actions={
          <>
            <ActionButton action="format" onClick={() => run(false)} variant="primary">
              {t("tools.xml.format")}
            </ActionButton>
            <ActionButton action="compact" onClick={() => run(true)}>
              {t("tools.xml.compact")}
            </ActionButton>
            <ActionButton action="validate" onClick={() => run(false, true)}>
              {t("tools.xml.validate")}
            </ActionButton>
            <ActionButton
              action="clear"
              onClick={() => {
                setInput("");
                setOutput("");
                setStatus("");
              }}
            >
              {t("actions.clear")}
            </ActionButton>
          </>
        }
        options={
          <>
            <label>
              {t("tools.common.indent")}
              <select
                aria-label={t("tools.common.indent")}
                className="select-input tool-option-select"
                onChange={(event) => setIndent(Number(event.currentTarget.value) as 2 | 4)}
                value={indent}
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
              </select>
            </label>
            <label>
              <input
                checked={wrap}
                onChange={(event) => setWrap(event.currentTarget.checked)}
                type="checkbox"
              />
              {t("tools.json.wrap")}
            </label>
          </>
        }
      />
      {status ? (
        <p className="tool-inline-status" role="status">
          {status}
        </p>
      ) : null}
      <TextPanels
        input={input}
        language="xml"
        onInputChange={(value) => {
          setInput(value);
          setStatus("");
        }}
        output={output}
        wrap={wrap}
      />
    </section>
  );
}

export function SqlToolView() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [dialect, setDialect] = useState<SqlDialect>("sql");
  const [keywordCase, setKeywordCase] = useState<SqlKeywordCase>("preserve");
  const [indent, setIndent] = useState<2 | 4>(2);
  const [wrap, setWrap] = useState(true);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const requestIdRef = useRef(0);

  function invalidatePending() {
    requestIdRef.current += 1;
    setWorking(false);
  }

  async function run() {
    if (!input.trim()) {
      setStatus(t("tools.sql.empty"));
      return;
    }
    const requestId = ++requestIdRef.current;
    setWorking(true);
    try {
      // 仅在实际格式化时加载方言库，避免拖慢其他功能的启动。
      const { transformSql } = await import("./sql");
      if (requestId !== requestIdRef.current) return;
      const result = transformSql(input, { dialect, keywordCase, indent });
      if (result.error) {
        setStatus(t(`tools.sql.errors.${result.error}`));
        return;
      }
      setOutput(result.output ?? "");
      setStatus("");
    } catch {
      if (requestId === requestIdRef.current) setStatus(t("tools.sql.errors.FORMAT_FAILED"));
    } finally {
      if (requestId === requestIdRef.current) setWorking(false);
    }
  }

  return (
    <section className="devbox-page devbox-page--fluid tool-page tool-page--editor">
      <ToolHeader title={t("tools.sql.title")} />
      <ToolActionBar
        actions={
          <>
            <ActionButton
              action="format"
              disabled={working}
              onClick={() => void run()}
              variant="primary"
            >
              {t("tools.sql.format")}
            </ActionButton>
            <ActionButton
              action="clear"
              onClick={() => {
                invalidatePending();
                setInput("");
                setOutput("");
                setStatus("");
              }}
            >
              {t("actions.clear")}
            </ActionButton>
          </>
        }
        options={
          <>
            <label>
              {t("tools.sql.dialect")}
              <select
                aria-label={t("tools.sql.dialect")}
                className="select-input tool-option-select"
                onChange={(event) => {
                  invalidatePending();
                  setDialect(event.currentTarget.value as SqlDialect);
                }}
                value={dialect}
              >
                <option value="sql">{t("tools.sql.dialects.sql")}</option>
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="transactsql">SQL Server</option>
                <option value="plsql">Oracle PL/SQL</option>
              </select>
            </label>
            <label>
              {t("tools.sql.keywordCase")}
              <select
                aria-label={t("tools.sql.keywordCase")}
                className="select-input tool-option-select"
                onChange={(event) => {
                  invalidatePending();
                  setKeywordCase(event.currentTarget.value as SqlKeywordCase);
                }}
                value={keywordCase}
              >
                <option value="preserve">{t("tools.sql.cases.preserve")}</option>
                <option value="upper">{t("tools.sql.cases.upper")}</option>
                <option value="lower">{t("tools.sql.cases.lower")}</option>
              </select>
            </label>
            <label>
              {t("tools.common.indent")}
              <select
                aria-label={t("tools.common.indent")}
                className="select-input tool-option-select"
                onChange={(event) => {
                  invalidatePending();
                  setIndent(Number(event.currentTarget.value) as 2 | 4);
                }}
                value={indent}
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
              </select>
            </label>
            <label>
              <input
                checked={wrap}
                onChange={(event) => setWrap(event.currentTarget.checked)}
                type="checkbox"
              />
              {t("tools.json.wrap")}
            </label>
          </>
        }
      />
      {status ? (
        <p className="tool-inline-status" role="status">
          {status}
        </p>
      ) : null}
      <TextPanels
        dialect={dialect}
        input={input}
        language="sql"
        onInputChange={(value) => {
          invalidatePending();
          setInput(value);
          setStatus("");
        }}
        output={output}
        wrap={wrap}
      />
    </section>
  );
}
