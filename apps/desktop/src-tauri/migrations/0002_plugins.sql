CREATE TABLE IF NOT EXISTS publishers (
    publisher_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_id TEXT NOT NULL UNIQUE,
    public_key_pem TEXT NOT NULL,
    trusted INTEGER NOT NULL DEFAULT 0 CHECK (trusted IN (0, 1)),
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS plugins (
    plugin_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    publisher_id TEXT NOT NULL REFERENCES publishers(publisher_id),
    current_version TEXT,
    previous_version TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('staging', 'installed', 'updating', 'disabled', 'uninstalling', 'failed')),
    source TEXT NOT NULL CHECK (source IN ('online', 'offline', 'development')),
    failure_count INTEGER NOT NULL DEFAULT 0,
    installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plugin_versions (
    plugin_id TEXT NOT NULL REFERENCES plugins(plugin_id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    install_path TEXT NOT NULL,
    archive_sha256 TEXT NOT NULL,
    signature_status TEXT NOT NULL CHECK (signature_status IN ('verified', 'unsigned-development')),
    source TEXT NOT NULL CHECK (source IN ('online', 'offline', 'development')),
    source_reference TEXT,
    healthy INTEGER NOT NULL DEFAULT 1 CHECK (healthy IN (0, 1)),
    installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plugin_id, version)
);

CREATE TABLE IF NOT EXISTS plugin_grants (
    plugin_id TEXT NOT NULL REFERENCES plugins(plugin_id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    granted INTEGER NOT NULL DEFAULT 0 CHECK (granted IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plugin_id, permission)
);

CREATE TABLE IF NOT EXISTS plugin_install_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin_id TEXT,
    version TEXT,
    operation TEXT NOT NULL,
    outcome TEXT NOT NULL,
    source TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plugin_events_plugin_id
    ON plugin_install_events(plugin_id, created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version) VALUES (2);
