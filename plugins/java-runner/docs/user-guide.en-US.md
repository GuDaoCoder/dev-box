# Java Snippet Runner User Guide

## Install

1. Install JDK 11 or newer and verify that `jshell --version` works.
2. Open **Plugin Manager → Add ZIP Plugin** in DevBox.
3. Select `devbox.java-snippet-runner-<version>.zip`.
4. Review the name, version, SHA-256, unsigned status, and `java:execute` permission.
5. Accept the security risk, install the plugin, and open **Languages → Java Snippet Runner**.

## Run

- Enter Java declarations, expressions, or statements supported by JShell.
- Select **Run** or press `Command/Ctrl + Enter`.
- Every run starts a fresh JShell session; definitions from previous runs are not retained.
- The output panel shows stdout, errors, status, duration, and exit code.
- The detected JDK version appears at the top; available syntax and standard-library APIs depend on that version.

Maven, Gradle, external dependencies, multi-file projects, package layouts, debugging, and full project compilation are not supported.

## Troubleshooting

- JShell not found: install JDK 11+, restart DevBox, and try again. The detected JDK version appears at the top of the plugin view.
- Execution timed out: each run is limited to 5 seconds; check for loops or blocking work.
- Output truncated: stdout and stderr share a combined 256 KiB limit.
- Permission denied: reinstall and grant `java:execute`, or verify that the plugin is enabled.
