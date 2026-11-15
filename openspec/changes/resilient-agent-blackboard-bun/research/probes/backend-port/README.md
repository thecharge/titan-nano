# Backend port probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Package versions are in `versions.txt`.

- `port.ts`: the common interface. A backend has an id, capability flags, `start()` and `resume()`. A session has `send()`.
- `claude.ts`, `codex.ts`, `api.ts`: adapters for the Claude Agent SDK, the Codex SDK and the model APIs through the AI SDK. They were only type-checked, not run live. Output: `tsc-output.txt`, "tsc exit 0", with TypeScript in strict mode.
- `toolserver.ts`, `toolclient.ts`: a stdio tool server with one tool, `kb_search`, and a client that lists and calls it. Output: `toolserver-output.txt`.
- `versions.txt` also holds the API key variable names, read from the files of each `@ai-sdk/*` package, and the two config key names found in the Codex binary.
