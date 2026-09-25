import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton, Button, CopyButton } from "@devbox/ui";

import {
  formatInTimeZone,
  generateUuids,
  hashText,
  parseTimestamp,
  textStats,
  transformEncoding,
  transformJson,
  type EncodingDirection,
  type EncodingMode,
  type HashAlgorithm,
  type HashEncoding,
  type TimestampResult,
} from "./algorithms";
import { LazyHighlightedText } from "./LazyHighlightedText";

export function ToolHeader({ title }: { title: string }) {
  return (
    <header className="page-header tool-page-header">
      <h1>{title}</h1>
    </header>
  );
}

export function ToolActionBar({ actions, options }: { actions: ReactNode; options?: ReactNode }) {
  return (
    <div className="tool-action-bar">
      <div className="tool-action-group">{actions}</div>
      {options ? <div className="tool-option-group">{options}</div> : null}
    </div>
  );
}

export function JsonToolView() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [sortKeys, setSortKeys] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [status, setStatus] = useState("");

  function run(compact: boolean) {
    if (!input.trim()) {
      setStatus(t("tools.json.empty"));
      return;
    }
    const result = transformJson(input, { compact, sortKeys });
    if (result.error) {
      setStatus(
        result.error.message === "INPUT_TOO_LARGE"
          ? t("tools.json.tooLarge")
          : t("tools.json.invalid", {
              line: result.error.line ?? "?",
              column: result.error.column ?? "?",
            }),
      );
      return;
    }
    setOutput(result.output ?? "");
    setStatus(t("tools.json.valid"));
  }

  return (
    <section className="devbox-page devbox-page--fluid tool-page tool-page--editor">
      <ToolHeader title={t("tools.json.title")} />
      <ToolActionBar
        actions={
          <>
            <ActionButton action="format" variant="primary" onClick={() => run(false)}>
              {t("tools.json.format")}
            </ActionButton>
            <ActionButton action="compact" onClick={() => run(true)}>
              {t("tools.json.compact")}
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
              <input
                checked={sortKeys}
                onChange={(event) => setSortKeys(event.currentTarget.checked)}
                type="checkbox"
              />
              {t("tools.json.sort")}
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
      <div className="tool-editor-grid">
        <article className="tool-editor">
          <div className="tool-editor-heading">
            <strong>{t("tools.common.input")}</strong>
            <small>{new TextEncoder().encode(input).byteLength.toLocaleString()} B</small>
          </div>
          <LazyHighlightedText
            label={t("tools.common.input")}
            language="json"
            onChange={setInput}
            value={input}
            wrap={wrap}
          />
        </article>
        <article className="tool-editor">
          <div className="tool-editor-heading">
            <strong>{t("tools.common.output")}</strong>
            <CopyButton
              copiedLabel={t("actions.copied")}
              label={t("actions.copy")}
              value={output}
            />
          </div>
          <LazyHighlightedText
            label={t("tools.common.output")}
            language="json"
            readOnly
            value={output}
            wrap={wrap}
          />
        </article>
      </div>
    </section>
  );
}

export function TimestampToolView() {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const [zone, setZone] = useState("UTC");
  const [result, setResult] = useState<TimestampResult>();
  const [error, setError] = useState("");
  const zones = ["UTC", "Asia/Shanghai", "America/New_York", "Europe/London", "Asia/Tokyo"];
  const rows = useMemo<Array<[string, string]>>(
    () =>
      result
        ? [
            [t("tools.timestamp.seconds"), String(result.seconds)],
            [t("tools.timestamp.milliseconds"), String(result.milliseconds)],
            ["ISO 8601", result.iso],
            [
              t("tools.timestamp.local"),
              formatInTimeZone(result.milliseconds, undefined, i18n.language),
            ],
            [
              t("tools.timestamp.zoned"),
              formatInTimeZone(result.milliseconds, zone, i18n.language),
            ],
          ]
        : [],
    [i18n.language, result, t, zone],
  );
  function convert(value = input) {
    try {
      setResult(parseTimestamp(value));
      setError("");
    } catch {
      setError(t("tools.timestamp.invalid"));
    }
  }
  return (
    <section className="devbox-page devbox-page--form tool-page">
      <ToolHeader title={t("tools.timestamp.title")} />
      <div className="surface-card tool-form">
        <div className="tool-form-grid">
          <label>
            {t("tools.timestamp.input")}
            <input
              className="text-input"
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
            />
          </label>
          <label>
            {t("tools.timestamp.timezone")}
            <select
              className="select-input"
              value={zone}
              onChange={(event) => setZone(event.currentTarget.value)}
            >
              {zones.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <ToolActionBar
          actions={
            <>
              <ActionButton action="convert" variant="primary" onClick={() => convert()}>
                {t("actions.convert")}
              </ActionButton>
              <ActionButton
                action="now"
                onClick={() => {
                  const value = String(Math.trunc(Date.now() / 1000));
                  setInput(value);
                  convert(value);
                }}
              >
                {t("tools.timestamp.now")}
              </ActionButton>
            </>
          }
        />
        {error ? <p className="tool-error">{error}</p> : null}
        <dl className="tool-result-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
              <CopyButton
                copiedLabel={t("actions.copied")}
                label={t("actions.copy")}
                value={value}
              />
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function EncodingToolView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EncodingMode>("base64");
  const [direction, setDirection] = useState<EncodingDirection>("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  function run() {
    try {
      setOutput(transformEncoding(input, mode, direction));
      setError("");
    } catch {
      setError(t("tools.encoding.invalid"));
    }
  }
  return (
    <section className="devbox-page devbox-page--fluid tool-page tool-page--editor">
      <ToolHeader title={t("tools.encoding.title")} />
      <ToolActionBar
        actions={
          <>
            <ActionButton action="convert" variant="primary" onClick={run}>
              {t(direction === "encode" ? "tools.encoding.encode" : "tools.encoding.decode")}
            </ActionButton>
            <ActionButton
              action="swap"
              onClick={() => {
                setInput(output);
                setOutput(input);
                setDirection(direction === "encode" ? "decode" : "encode");
              }}
            >
              {t("actions.swap")}
            </ActionButton>
            <ActionButton
              action="clear"
              onClick={() => {
                setInput("");
                setOutput("");
                setError("");
              }}
            >
              {t("actions.clear")}
            </ActionButton>
          </>
        }
        options={
          <>
            <div aria-label={t("tools.encoding.mode")} className="segmented-control" role="group">
              {(["base64", "url", "hex"] as const).map((item) => (
                <Button
                  aria-pressed={mode === item}
                  className={mode === item ? "is-selected" : undefined}
                  key={item}
                  variant="ghost"
                  onClick={() => setMode(item)}
                >
                  {item === "hex" ? "UTF-8 Hex" : item.toUpperCase()}
                </Button>
              ))}
            </div>
            <div
              aria-label={t("tools.encoding.direction")}
              className="segmented-control"
              role="group"
            >
              <Button
                aria-pressed={direction === "encode"}
                className={direction === "encode" ? "is-selected" : undefined}
                variant="ghost"
                onClick={() => setDirection("encode")}
              >
                {t("tools.encoding.encode")}
              </Button>
              <Button
                aria-pressed={direction === "decode"}
                className={direction === "decode" ? "is-selected" : undefined}
                variant="ghost"
                onClick={() => setDirection("decode")}
              >
                {t("tools.encoding.decode")}
              </Button>
            </div>
          </>
        }
      />
      {error ? <p className="tool-error">{error}</p> : null}
      <div className="tool-editor-grid">
        <article className="tool-editor">
          <div className="tool-editor-heading">
            <strong>{t("tools.common.input")}</strong>
          </div>
          <textarea
            aria-label={t("tools.common.input")}
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
          />
        </article>
        <article className="tool-editor">
          <div className="tool-editor-heading">
            <strong>{t("tools.common.output")}</strong>
            <CopyButton
              copiedLabel={t("actions.copied")}
              label={t("actions.copy")}
              value={output}
            />
          </div>
          <textarea aria-label={t("tools.common.output")} readOnly value={output} />
        </article>
      </div>
    </section>
  );
}

export function UuidHashToolView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"uuid" | "hash">("uuid");
  const [count, setCount] = useState("5");
  const [uuidOutput, setUuidOutput] = useState("");
  const [input, setInput] = useState("");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [encoding, setEncoding] = useState<HashEncoding>("hex");
  const [hashOutput, setHashOutput] = useState("");
  const [error, setError] = useState("");
  const stats = useMemo(() => textStats(input), [input]);
  function generate() {
    try {
      setUuidOutput(generateUuids(Number(count)).join("\n"));
      setError("");
    } catch {
      setError(t("tools.uuid.invalidCount"));
    }
  }
  return (
    <section className="devbox-page devbox-page--form tool-page">
      <ToolHeader title={t("tools.uuid.title")} />
      <div className="segmented-control tool-mode-switcher" role="tablist">
        <Button
          aria-selected={mode === "uuid"}
          className={mode === "uuid" ? "is-selected" : undefined}
          role="tab"
          variant="ghost"
          onClick={() => setMode("uuid")}
        >
          UUID v4
        </Button>
        <Button
          aria-selected={mode === "hash"}
          className={mode === "hash" ? "is-selected" : undefined}
          role="tab"
          variant="ghost"
          onClick={() => setMode("hash")}
        >
          {t("tools.uuid.hash")}
        </Button>
      </div>
      {error ? <p className="tool-error">{error}</p> : null}
      {mode === "uuid" ? (
        <div className="surface-card tool-form">
          <div className="tool-inline-form">
            <label>
              {t("tools.uuid.count")}
              <input
                className="text-input"
                type="number"
                min="1"
                max="1000"
                value={count}
                onChange={(event) => setCount(event.currentTarget.value)}
              />
            </label>
            <ActionButton action="generate" variant="primary" onClick={generate}>
              {t("tools.uuid.generate")}
            </ActionButton>
          </div>
          <div className="tool-editor-heading">
            <strong>UUID v4</strong>
            <CopyButton
              copiedLabel={t("actions.copied")}
              label={t("actions.copy")}
              value={uuidOutput}
            />
          </div>
          <textarea
            className="tool-standalone-output"
            aria-label="UUID v4"
            readOnly
            value={uuidOutput}
          />
        </div>
      ) : (
        <div className="surface-card tool-form">
          <label>
            {t("tools.uuid.input")}
            <textarea
              className="tool-hash-input"
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
            />
          </label>
          <p className="tool-helper">
            {stats.characters} {t("tools.uuid.characters")} · {stats.bytes} {t("tools.uuid.bytes")}{" "}
            · {t("tools.uuid.digestNote")}
          </p>
          <div className="tool-form-grid">
            <label>
              {t("tools.uuid.algorithm")}
              <select
                className="select-input"
                value={algorithm}
                onChange={(event) => setAlgorithm(event.currentTarget.value as HashAlgorithm)}
              >
                {["SHA-256", "SHA-384", "SHA-512"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              {t("tools.uuid.outputEncoding")}
              <select
                className="select-input"
                value={encoding}
                onChange={(event) => setEncoding(event.currentTarget.value as HashEncoding)}
              >
                <option value="hex">Hex</option>
                <option value="base64">Base64</option>
              </select>
            </label>
          </div>
          <ToolActionBar
            actions={
              <>
                <ActionButton
                  action="calculate"
                  variant="primary"
                  onClick={() => void hashText(input, algorithm, encoding).then(setHashOutput)}
                >
                  {t("tools.uuid.calculate")}
                </ActionButton>
                <ActionButton
                  action="clear"
                  onClick={() => {
                    setInput("");
                    setHashOutput("");
                  }}
                >
                  {t("actions.clear")}
                </ActionButton>
              </>
            }
          />
          <div className="tool-output-block">
            <div className="tool-editor-heading">
              <strong>{t("tools.common.output")}</strong>
              <CopyButton
                copiedLabel={t("actions.copied")}
                label={t("actions.copy")}
                value={hashOutput}
              />
            </div>
            <output className="tool-hash-output">{hashOutput}</output>
          </div>
        </div>
      )}
    </section>
  );
}
