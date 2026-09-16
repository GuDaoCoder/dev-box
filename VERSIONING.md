# Versioning and artifact naming

DevBox uses Semantic Versioning: `MAJOR.MINOR.PATCH`.

- Before Plugin API v1, application releases use `0.x.y` and may change internal contracts.
- Application versions are kept synchronized in the root package, desktop package, Tauri config and Rust crate.
- `pnpm version:check` fails when these sources differ.
- Release tags use `app-v<version>`, for example `app-v0.1.0`.
- CI artifacts use `devbox-<version>-<os>-<arch>`, for example `devbox-0.1.0-macos-arm64`.
- Signing and notarization are release concerns; unsigned CI artifacts must be labeled as development builds.
