// Loaded before every test file by bunfig.toml [test] preload.
// Unit and integration tests may only talk to 127.0.0.1 / localhost / ::1.
// Live tests (TITAN_LIVE_*=1) are the only exception.
import net from "node:net";
import tls from "node:tls";

const live = Object.keys(process.env).some((k) => k.startsWith("TITAN_LIVE_") && process.env[k] === "1");
const LOCAL = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const blocked = (host: string) => new Error(`network blocked in tests: ${host}`);

if (!live) {
  // 1. Remove every real key, so no code can use one by accident.
  for (const k of Object.keys(process.env)) {
    if (/_API_KEY$|_TOKEN$|^ANTHROPIC_|^OPENAI_|^GEMINI_|^GOOGLE_API|^RUNPOD_/.test(k)) delete process.env[k];
  }
  // 2. fetch
  const realFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (!LOCAL.has(url.hostname)) throw blocked(url.hostname);
      return realFetch(input, init);
    },
    { preconnect: () => {} },
  ) as typeof fetch;
  // 3. raw sockets: node:net, node:tls and Bun.connect
  const guard = (orig: (...a: any[]) => any) =>
    function (this: unknown, ...a: any[]) {
      const o = a[0];
      const host = typeof o === "object" && o ? (o.host ?? o.hostname ?? "localhost") : typeof a[1] === "string" ? a[1] : "localhost";
      if (!LOCAL.has(host)) throw blocked(host);
      return orig.apply(this, a);
    };
  (net as any).connect = guard(net.connect);
  (net as any).createConnection = guard(net.createConnection);
  (tls as any).connect = guard(tls.connect);
  (net.Socket.prototype as any).connect = guard(net.Socket.prototype.connect);
  (Bun as any).connect = guard(Bun.connect);
}
