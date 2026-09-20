-- 这些功能已经迁入平台内置注册表，旧插件记录与当前清单结构不再兼容。
DELETE FROM settings
WHERE plugin_id IN (
    'devbox.official.json-tool',
    'devbox.official.timestamp-tool',
    'devbox.official.encoding-tool',
    'devbox.official.uuid-hash-tool'
);

DELETE FROM plugins
WHERE plugin_id IN (
    'devbox.official.json-tool',
    'devbox.official.timestamp-tool',
    'devbox.official.encoding-tool',
    'devbox.official.uuid-hash-tool'
);

INSERT OR IGNORE INTO schema_migrations (version) VALUES (3);
