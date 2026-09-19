# DevBox ZIP Plugin Development Guide

## Minimal layout

```text
my-plugin/
├── plugin.json
├── dist/
│   ├── index.html
│   ├── plugin.js
│   └── style.css
└── locales/
    ├── zh-CN.json
    └── en-US.json
```

`plugin.json` must be at the ZIP root rather than inside another project directory. The runtime accepts only plugins with `type: "ui"`.

## Manifest example

```json
{
  "schemaVersion": 1,
  "id": "devbox.example.converter",
  "name": "Example Converter",
  "description": "Example conversion tool",
  "version": "1.0.0",
  "publisher": { "id": "example-team", "name": "Example Team" },
  "engines": { "devbox": ">=0.1.0, <0.2.0", "pluginApi": "^1.0.0" },
  "type": "ui",
  "entry": { "main": "dist/index.html" },
  "activationEvents": ["onView:converter"],
  "permissions": ["storage:read", "storage:write"],
  "locales": {
    "zh-CN": "locales/zh-CN.json",
    "en-US": "locales/en-US.json"
  },
  "contributes": {
    "views": [
      {
        "id": "converter",
        "titleKey": "converter.title",
        "icon": "code",
        "order": 10,
        "category": {
          "id": "conversion",
          "title": { "zh-CN": "转换", "en-US": "Conversion" },
          "order": 40
        }
      }
    ]
  }
}
```

Every view declares a category, bilingual category titles, a feature order, and an icon. Supported icons are `binary`, `box`, `braces`, `clock`, `code`, `fingerprint`, and `plug`. The only available permissions are `storage:read`, `storage:write`, `clipboard:read`, and `clipboard:write`.

## Validate and package

Validate a source directory from the DevBox repository:

```sh
node packages/plugin-pack/src/cli.mjs validate ./my-plugin
```

An unsigned plugin may be created with a standard ZIP tool, provided the root contains `plugin.json`, `dist/`, and optional `locales/`. DevBox allows installation but keeps an unsigned warning visible.

For distribution, prefer an Ed25519-signed package. Add the public key's `keyId` to `publisher.keyId`, then run:

```sh
node packages/plugin-pack/src/cli.mjs pack ./my-plugin \
  --output ./my-plugin-1.0.0.zip \
  --key ./ed25519-private-key.pem \
  --key-id <key-id>
```

Verify the package with the public key:

```sh
node packages/plugin-pack/src/cli.mjs verify ./my-plugin-1.0.0.zip \
  --public-key ./ed25519-public-key.pem
```

Never commit production private keys. Fixture keys in this repository are for testing only.

## Host boundaries

- A plugin runs in an isolated `plugin-*` WebView without direct file-dialog access.
- Plugin CSP blocks network connections.
- Storage is scoped by plugin ID and checked against user grants.
- Clipboard calls require grants; sensitive writes also require a short-lived, one-time user-gesture token.
- Do not rely on `file://`, absolute or parent paths, symbolic links, or remote scripts.

Package limits are 25 MiB archived, 50 MiB expanded, 8 MiB per file, 512 files, and a maximum per-file compression ratio of 100.
