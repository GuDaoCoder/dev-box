# DevBox User Guide

## Install and start

Download the artifact for your platform from the project release workflow: DMG for macOS, MSI or setup executable for Windows, and AppImage, DEB, or RPM for Linux. Production code signing and Apple notarization are not configured yet, so the operating system may identify these as development builds. Verify the source before proceeding.

Running from source requires Node.js 20.19+, pnpm 12.4, stable Rust, and the platform prerequisites for Tauri 2:

```sh
corepack enable
pnpm install
pnpm tauri dev
```

If the shell reports `command not found: pnpm`, run `corepack enable`. If needed, follow with `corepack prepare pnpm@12.4.2 --activate`.

## Use the workspace

- The left tree groups features by category.
- Selecting a feature opens a tab; a feature can only be open once.
- Drag tabs to reorder them. Right-click a tab to close the current, all, right-side, or other tabs.
- With a tab focused, use Left/Right to switch, Home/End to jump, and Delete to close.
- Open the command palette with `⌘K` on macOS or `Ctrl+K` on Windows and Linux.
- Open tabs are not restored after restart.

## Built-in tools

- JSON Tool formats, compacts, validates, and recursively sorts object keys, with a 2 MiB input limit.
- Timestamp Tool converts seconds, milliseconds, dates, and common IANA time zones.
- Encoding Tool supports Base64, URL, and UTF-8 hexadecimal transformations.
- UUID & Hash generates UUID v4 values and SHA-256, SHA-384, or SHA-512 digests.

All transformations happen locally; tool input is not uploaded.

## Language and theme

Open System → Settings and choose Follow system, Simplified Chinese, or English. Language selection is available only in Settings, applies immediately, and is stored locally. Dark and light themes are configured on the same page.

## Install a custom plugin

1. Open Plugins → Plugin Manager.
2. Select Add ZIP Plugin and choose a ZIP containing `plugin.json`.
3. Review the plugin ID, publisher, version, signature state, and permissions.
4. Unsigned plugins show a security warning. Continue only when you trust the source.
5. After installation, open the feature from the category declared by the plugin.

Plugins can be enabled, disabled, updated, rolled back, or uninstalled. Uninstalling can optionally remove local plugin data. DevBox has no online plugin catalog, automatic download, or automatic update.

## Troubleshooting

- ZIP selection and plugin views do not work in browser-only development. Start the desktop app with `pnpm tauri dev`.
- If a ZIP is rejected, verify its extension, root `plugin.json`, entry HTML, compatibility, paths, size, and permissions.
- “Unsigned” means DevBox cannot verify publisher identity or package integrity; installation remains possible after the warning.
- When reporting an issue, include the OS, DevBox version, reproduction steps, and full error message. Never include private keys or sensitive tool input.
