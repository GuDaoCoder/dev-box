import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CorePingResponse, SettingRecord } from "@devbox/ipc-contracts";
import type { PluginAPI } from "@devbox/plugin-sdk";
import { Badge, Button } from "@devbox/ui";

export function FoundationView({ api }: { api: PluginAPI }) {
  const { t } = useTranslation("plugin-foundation");
  const [health, setHealth] = useState<CorePingResponse>();
  const [record, setRecord] = useState<SettingRecord>();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void api.settings
      .get("displayName")
      .then((saved) => {
        setRecord(saved);
        if (typeof saved?.value === "string") {
          setDisplayName(saved.value);
        }
      })
      .catch(() => setFailed(true));
  }, [api]);

  async function pingHost() {
    setBusy(true);
    setFailed(false);
    try {
      setHealth(await api.core.ping());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function saveSetting() {
    setBusy(true);
    setFailed(false);
    try {
      setRecord(await api.settings.update("displayName", displayName, record?.revision));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="plugin-page" aria-labelledby="foundation-title">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">{t("page.eyebrow")}</p>
          <h1 id="foundation-title">{t("page.title")}</h1>
          <p>{t("page.description")}</p>
        </div>
        <Badge tone={health?.ready ? "success" : "neutral"}>
          {health?.ready ? t("page.ready") : t("page.notChecked")}
        </Badge>
      </header>

      {failed ? (
        <p className="inline-error" role="alert">
          {t("page.failed")}
        </p>
      ) : null}

      <div className="foundation-grid">
        <article className="surface-card">
          <div>
            <h2>{t("page.hostTitle")}</h2>
            <p>{t("page.hostDescription")}</p>
          </div>
          {health ? (
            <dl className="detail-list">
              <div>
                <dt>{t("page.ready")}</dt>
                <dd>{health.ready ? "✓" : "—"}</dd>
              </div>
              <div>
                <dt>{t("page.version", { version: health.version })}</dt>
                <dd>{health.application}</dd>
              </div>
            </dl>
          ) : null}
          <Button disabled={busy} onClick={() => void pingHost()} variant="primary">
            {t("page.hostAction")}
          </Button>
        </article>

        <article className="surface-card">
          <div>
            <h2>{t("page.settingTitle")}</h2>
            <p>{t("page.settingDescription")}</p>
          </div>
          <label className="field-label" htmlFor="foundation-display-name">
            {t("page.settingLabel")}
          </label>
          <input
            id="foundation-display-name"
            className="text-input"
            maxLength={80}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
            placeholder={t("page.settingPlaceholder")}
            value={displayName}
          />
          <p className="field-hint">
            {record ? t("page.saved", { revision: record.revision }) : t("page.notSaved")}
          </p>
          <Button
            disabled={busy || displayName.trim().length === 0}
            onClick={() => void saveSetting()}
          >
            {t("page.save")}
          </Button>
        </article>
      </div>
    </section>
  );
}
