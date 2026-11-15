# Plug-in probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10.

`@titan/core` loads plug-in packages by name. It checks `specificationVersion` and refuses a backend id that is already used. The run asks for a good plug-in, an old one, a missing one and the good one again.
- `packages/core/src/index-first-try.ts` and `plugin-first-try-output.txt`: `import(name)` looks from the folder of `@titan/core`, so no plug-in is found.
- `packages/core/src/index.ts` and `plugin-output.txt`: `Bun.resolveSync(name, folder)` looks from the user's folder. The good plug-in loads. The old one, the missing one and the second copy are refused with a reason.
