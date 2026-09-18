# DevBox desktop

The desktop application combines a React + TypeScript frontend with a Tauri 2 Rust host.

From the repository root:

```sh
pnpm install
pnpm dev
pnpm tauri dev
pnpm check
```

The desktop now includes the M1 shell and the M2 Plugin Center. M2 adds signed online/offline package preflight, atomic installation and rollback, SQLite-backed plugin state, and isolated plugin WebView windows without Tauri IPC permissions.
