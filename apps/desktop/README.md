# DevBox desktop

The desktop application combines a React + TypeScript frontend with a Tauri 2 Rust host.

From the repository root:

```sh
pnpm install
pnpm dev
pnpm tauri dev
pnpm check
```

The desktop includes the application shell, four built-in tools, a multi-tab workspace, and local ZIP plugin management. Custom plugins use atomic installation and rollback, SQLite-backed state, and isolated child WebViews without direct Tauri IPC permissions. Unsigned ZIP files are allowed only after a visible security warning.
