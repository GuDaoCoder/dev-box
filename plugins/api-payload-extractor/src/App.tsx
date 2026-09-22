import { useEffect, useState } from "react";
import { Braces, Clipboard, Eraser, FileInput, Sparkles } from "lucide-react";

import { ExtractionError, extractApiPayload, type PayloadFormat } from "./extractor";
import { detectLocale, translate, type MessageKey } from "./i18n";

export function App() {
  const [locale, setLocale] = useState(() => detectLocale());
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState<PayloadFormat>();
  const [message, setMessage] = useState<MessageKey>();
  const [copied, setCopied] = useState(false);
  const t = (key: MessageKey) => translate(locale, key);

  useEffect(() => {
    document.documentElement.lang = locale;
    void window.__DEVBOX_PLUGIN_API__?.reportReady?.();
  }, [locale]);

  useEffect(() => {
    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<unknown>).detail;
      if (nextLocale === "zh-CN" || nextLocale === "en-US") setLocale(nextLocale);
    };
    window.addEventListener("devbox:locale-change", handleLocaleChange);
    return () => window.removeEventListener("devbox:locale-change", handleLocaleChange);
  }, []);

  function extract() {
    setCopied(false);
    try {
      const result = extractApiPayload(input);
      setOutput(result.output);
      setFormat(result.format);
      setMessage(result.format === "text" ? "plainText" : undefined);
    } catch (error) {
      setOutput("");
      setFormat(undefined);
      if (error instanceof ExtractionError) {
        setMessage(
          error.code === "EMPTY_INPUT"
            ? "empty"
            : error.code === "BODY_MISSING"
              ? "bodyMissing"
              : "invalidLog",
        );
      } else setMessage("invalidLog");
    }
  }

  function clear() {
    setInput("");
    setOutput("");
    setFormat(undefined);
    setMessage(undefined);
    setCopied(false);
  }

  async function copy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
  }

  return (
    <main className="tool-shell">
      <header className="tool-header">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h1>{t("title")}</h1>
        </div>
      </header>

      <div className="action-bar">
        <button className="primary-button" onClick={extract} type="button">
          <Sparkles aria-hidden="true" size={14} />
          {t("extract")}
        </button>
        <button className="secondary-button" onClick={clear} type="button">
          <Eraser aria-hidden="true" size={14} />
          {t("clear")}
        </button>
      </div>

      {message ? (
        <div className="message" role="status">
          {t(message)}
        </div>
      ) : null}

      <section className="workspace">
        <article className="panel">
          <div className="panel-toolbar">
            <div className="panel-title">
              <FileInput aria-hidden="true" size={16} />
              <strong>{t("input")}</strong>
            </div>
            <span>{new TextEncoder().encode(input).byteLength} B</span>
          </div>
          <textarea
            aria-label={t("input")}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            value={input}
          />
        </article>

        <article className="panel">
          <div className="panel-toolbar">
            <div className="panel-title">
              <Braces aria-hidden="true" size={16} />
              <strong>{t("output")}</strong>
              {format ? <span className="format-badge">{t(format)}</span> : null}
            </div>
            <button
              className="copy-button"
              disabled={!output}
              onClick={() => void copy()}
              type="button"
            >
              <Clipboard aria-hidden="true" size={14} />
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <textarea aria-label={t("output")} readOnly spellCheck={false} value={output} />
        </article>
      </section>
    </main>
  );
}
