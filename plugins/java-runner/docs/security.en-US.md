# Security

`java:execute` is not an operating-system sandbox. Code runs in the system JShell with the current user's privileges and may read or modify local files, access the network or environment, and start other processes.

Security boundaries:

- DevBox validates plugin identity, the granted permission, and a one-time trusted user gesture.
- The plugin can submit only source, timeout, and output limits. It cannot choose the JShell executable, arguments, working directory, or environment.
- The Host uses JDK 11+, a temporary directory, and a fresh JShell process.
- Each request is limited to 64 KiB of source, 5 seconds, and 256 KiB of combined output, with one active run per plugin.
- A timeout terminates JShell and cleans the temporary directory, but external side effects already produced by code cannot be undone.

Run only code you wrote or reviewed. Do not execute unknown snippets or place passwords, tokens, private keys, or production data in the editor.
