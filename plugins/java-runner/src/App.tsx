import { lazy, Suspense, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Clock3, Code2, Play, RotateCcw, Terminal } from "lucide-react";

import { detectLocale, translate } from "./i18n";
import {
  createExecutionRequest,
  formatHostError,
  getJavaEnvironment,
  getJavaRunnerAPI,
  reportPluginReady,
  type JavaExecutionResult,
} from "./java-runner";

const JavaCodeEditor = lazy(() => import("./JavaCodeEditor"));

export function App() {
  const [locale, setLocale] = useState(() => detectLocale());
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const [source, setSource] = useState("");
  const [result, setResult] = useState<JavaExecutionResult>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const runner = getJavaRunnerAPI();
  const javaEnvironment = getJavaEnvironment();

  useEffect(() => {
    document.documentElement.lang = locale;
    void reportPluginReady();
  }, [locale]);

  useEffect(() => {
    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<unknown>).detail;
      if (nextLocale === "zh-CN" || nextLocale === "en-US") setLocale(nextLocale);
    };
    window.addEventListener("devbox:locale-change", handleLocaleChange);
    return () => window.removeEventListener("devbox:locale-change", handleLocaleChange);
  }, []);

  async function run() {
    setError(undefined);
    let request;
    try {
      request = createExecutionRequest(source);
    } catch {
      setError(t("invalid"));
      return;
    }
    if (!runner) {
      setError(t("unavailable"));
      return;
    }
    setRunning(true);
    setResult(undefined);
    try {
      setResult(await runner.execute(request));
    } catch (nextError) {
      setError(formatHostError(nextError) ?? t("hostError"));
    } finally {
      setRunning(false);
    }
  }

  const statusText = result
    ? result.status === "success"
      ? t("success")
      : result.status === "timeout"
        ? t("timedOut")
        : t("failed")
    : t("ready");

  return (
    <main className="runner-shell">
      <header className="runner-header">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h1>{t("title")}</h1>
        </div>
        <div className="runtime-badge">
          <Code2 aria-hidden="true" size={16} />
          {javaEnvironment
            ? t("runtime", { version: javaEnvironment.version })
            : t("runtimeMissing")}
        </div>
      </header>

      <div className="runner-action-bar">
        <button className="run-button" disabled={running} onClick={() => void run()} type="button">
          <Play aria-hidden="true" fill="currentColor" size={14} />
          {running ? t("running") : t("run")}
        </button>
      </div>

      <section className="runner-grid">
        <article className="panel editor-panel">
          <div className="panel-toolbar">
            <div className="panel-title">
              <Code2 aria-hidden="true" size={16} />
              <strong>{t("editor")}</strong>
              <span>Snippet.java</span>
            </div>
          </div>
          <Suspense fallback={<div className="editor-loading">{t("loadingEditor")}</div>}>
            <JavaCodeEditor onChange={setSource} onRun={() => void run()} value={source} />
          </Suspense>
          <div className="editor-footer">
            <span>{new TextEncoder().encode(source).byteLength} / 65536 B</span>
          </div>
        </article>

        <article className="panel output-panel" aria-live="polite">
          <div className="panel-toolbar">
            <div className="panel-title">
              <Terminal aria-hidden="true" size={16} />
              <strong>{t("output")}</strong>
            </div>
            <button
              aria-label={t("clear")}
              className="icon-button"
              onClick={() => {
                setResult(undefined);
                setError(undefined);
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} />
            </button>
          </div>

          <div className="output-body">
            {error ? (
              <div className="notice warning">
                <CircleAlert aria-hidden="true" size={18} />
                <span>{error}</span>
              </div>
            ) : null}
            {result ? (
              <>
                {result.truncated ? (
                  <div className="notice warning">
                    <CircleAlert aria-hidden="true" size={18} />
                    <span>{t("outputTruncated")}</span>
                  </div>
                ) : null}
                {result.stdout ? <pre className="stdout">{result.stdout}</pre> : null}
                {result.stderr ? <pre className="stderr">{result.stderr}</pre> : null}
              </>
            ) : !error ? (
              <div aria-label={t("ready")} className="output-empty">
                <Terminal aria-hidden="true" size={28} />
              </div>
            ) : null}
          </div>

          <footer className="result-footer">
            <span className={result?.status === "success" ? "success" : ""}>
              {result?.status === "success" ? (
                <CircleCheck aria-hidden="true" size={14} />
              ) : (
                <Clock3 aria-hidden="true" size={14} />
              )}
              {statusText}
            </span>
            {result ? (
              <span>
                {t("elapsed", { value: result.durationMs })} ·{" "}
                {t("exitCode", { value: result.exitCode ?? "—" })}
              </span>
            ) : null}
          </footer>
        </article>
      </section>
    </main>
  );
}
