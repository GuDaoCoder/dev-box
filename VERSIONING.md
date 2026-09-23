# Versioning and artifact naming

DevBox uses Semantic Versioning: `MAJOR.MINOR.PATCH`.

- Before Plugin API v1, application releases use `0.x.y` and may change internal contracts.
- Application versions are kept synchronized in the root package, desktop package, Tauri config and Rust crate.
- `pnpm version:check` fails when these sources differ.
- Release tags use `app-v<version>`, for example `app-v0.1.0`.
- CI artifacts use `devbox-<version>-<os>-<arch>`, for example `devbox-0.1.0-macos-arm64`.
- Signing and notarization are release concerns; unsigned CI artifacts must be labeled as development builds.

## Release process

1. Run `pnpm version:set <version>` to synchronize the application version files.
2. Run `pnpm version:check` and `pnpm check:release`.
3. Commit the version change, then create the annotated tag `app-v<version>` on that commit.
4. Push the branch and tag together. The Release workflow builds Windows installers with bundled and system WebView2, plus macOS disk images for Apple Silicon and Intel.
5. The workflow publishes the installers and `SHA256SUMS.txt` to the GitHub Release that matches the tag.

The workflow can be rerun manually only for an existing `app-v*` tag. Normal branch pushes never create a release.
