# DevBox Security Notes

DevBox treats local ZIP archives and plugin code as untrusted input. The Rust Host independently validates paths, structure, limits, compatibility, checksums, signatures, and permissions. Frontend warnings never replace Host validation.

## Implemented boundaries

- Only `.zip` input is accepted. Absolute, parent, backslash, duplicate, and symbolic-link paths are rejected.
- Archive, expanded, per-file, file-count, and compression-ratio limits reduce ZIP bomb exposure.
- Signed packages verify every file with SHA-256 and Ed25519. A partially present signature set is rejected.
- Unsigned packages can be installed, but both confirmation and installed views keep a warning visible.
- Plugin WebView identity is bound by the Host. Calls check the window, plugin ID, version, secret, grant, and user gesture where required.
- Plugin assets receive a CSP that blocks network, objects, base URIs, and form submission, plus `nosniff`.
- Repeated plugin runtime failures can trigger rollback or disable the plugin.
- `java:execute` requires an install grant and a one-time user gesture, with input, timeout, output, and per-plugin concurrency limits. JShell still runs with the current user's privileges and is not an operating-system sandbox.

## User responsibility

Unsigned does not necessarily mean malicious, but publisher identity and content integrity cannot be verified. Install ZIP files only from sources you trust, review permissions, and do not expose passwords, tokens, private keys, or production data to an unknown plugin. Disable or uninstall suspicious plugins and retain the ZIP SHA-256 for investigation.

After granting `java:execute`, snippets may access local files, the network, or launch other processes. Run only code you wrote or reviewed.

## Current limitations

- CI artifacts do not yet have production code signing, Windows reputation, Apple notarization, or Linux repository signing.
- A plugin signature is reported as verified only when its publisher public key is in the Host trust store; otherwise it is treated as unsigned.
- There is no online revocation service or automatic security update. Users update plugins by selecting another ZIP.

Run `pnpm security:check` and the Rust tests for security regression coverage. Use `pnpm check:release` for the complete local release gate.
