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

## M2 plugin distribution fixture

Generate deterministic signed packages and the local test catalog:

```sh
pnpm fixtures:m2
```

The generated files are written to `fixtures/m2/generated/`. The committed private key is for local M2 testing only and must never be used for production releases.

The public SDK and packaging packages can be packed independently for integration with the separate `devbox-tools` repository:

```sh
pnpm sdk:pack
```

Architecture, UI design and the MVP backlog are available in [`design/`](./design/).
