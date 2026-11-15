import { mock } from "bun:test";
import childProcess from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { resolve, sep } from "node:path";
import tls from "node:tls";

if (process.env.TITAN_TEST_BOUNDARY !== "podman")
  throw new Error("Tests require the OS boundary: run bun run test");
for (const key of Object.keys(process.env)) {
  if (/_API_KEY$|_TOKEN$|^ANTHROPIC_|^OPENAI_|^GEMINI_|^GOOGLE_API|^RUNPOD_|^TITAN_LIVE_/.test(key))
    delete process.env[key];
}
const local = ["127.0.0.1", "localhost", "[::1]", "::1"];
const fixtures = resolve(import.meta.dir, "../fixtures") + sep;
const shellSyntax = /[;&|`$<>(){}\\\n*?]/;

function hostOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (!value.includes("/") && !value.includes(":")) return value;
    return URL.canParse(value) ? new URL(value).hostname : value;
  }
  if (value instanceof URL) return value.hostname;
  if (value instanceof Request) return new URL(value.url).hostname;
  if (value && typeof value === "object") {
    const options = new Map(Object.entries(value));
    return hostOf(options.get("hostname") ?? options.get("host") ?? "localhost");
  }
  return undefined;
}
function checkHost(args: unknown[]): void {
  const first = args[0];
  const host =
    typeof first === "number" && typeof args[1] === "string"
      ? args[1]
      : (hostOf(first) ?? "unknown");
  if (!local.includes(host)) throw new Error(`network blocked in tests: ${host}`);
}
function allowedProgram(cmd: unknown): boolean {
  return (
    typeof cmd === "string" &&
    (["bun", "git", process.execPath].includes(cmd) || resolve(cmd).startsWith(fixtures))
  );
}
function checkProgram(args: unknown[]): void {
  const entry = args[0];
  const cmd = Array.isArray(entry)
    ? entry[0]
    : entry && typeof entry === "object" && "cmd" in entry && Array.isArray(entry.cmd)
      ? entry.cmd[0]
      : entry;
  if (!allowedProgram(cmd)) throw new Error(`process blocked in tests: ${String(cmd)}`);
}
function checkShell(args: unknown[]): void {
  const line = String(args[0]);
  const program = line.trim().split(/\s+/)[0];
  if (shellSyntax.test(line) || !allowedProgram(program))
    throw new Error(`process blocked in tests: ${line}`);
}
function guard<T extends object>(target: T, names: string[], check: (args: unknown[]) => void): T {
  const record = target as Record<string, unknown>;
  for (const name of names) {
    const original = record[name];
    if (typeof original !== "function") continue;
    record[name] = new Proxy(original, {
      apply(fn, receiver, args: unknown[]) {
        check(args);
        return Reflect.apply(fn, receiver, args);
      },
    });
  }
  return target;
}
function republish(name: string, target: object): void {
  const module = { ...target, default: target } as Record<string, unknown>;
  mock.module(name, () => module);
}

globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, receiver, args: Parameters<typeof fetch>) {
    checkHost(args);
    return Reflect.apply(target, receiver, args);
  },
});
guard(Bun, ["connect"], checkHost);
guard(Bun, ["spawn", "spawnSync"], checkProgram);
for (const [name, target] of [
  ["node:http", http],
  ["node:https", https],
] as const) {
  guard(target, ["request", "get"], checkHost);
  republish(name, target);
}
guard(net, ["connect", "createConnection"], checkHost);
republish("node:net", net);
guard(tls, ["connect"], checkHost);
republish("node:tls", tls);
guard(childProcess, ["spawn", "spawnSync", "execFile", "execFileSync", "fork"], checkProgram);
guard(childProcess, ["exec", "execSync"], checkShell);
republish("node:child_process", childProcess);
