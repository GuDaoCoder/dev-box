# DevBox

DevBox is a local-first, plugin-based desktop toolbox for developers. The project uses Tauri 2, React, TypeScript, Vite and Rust in a pnpm workspace.

## Prerequisites

- Node.js 20.19 or newer
- pnpm 12.4
- Stable Rust with `rustfmt` and `clippy`
- Platform prerequisites required by Tauri 2

## Development

```sh
pnpm install
pnpm dev
pnpm tauri dev
```

## Verification

```sh
pnpm check
pnpm build
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
pnpm test:e2e
pnpm tauri build --no-bundle
```

Architecture, UI design and the MVP backlog are available in [`design/`](./design/).
