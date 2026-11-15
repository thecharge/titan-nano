import { expect } from "bun:test";
import { execSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { get as httpGet } from "node:http";
import https from "node:https";
import { connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { resolve } from "node:path";
import { all } from "@titan/core";

const agentFixture = resolve(import.meta.dir, "../fixtures/guard-agent.mjs");

const probe = `
import { connect } from "node:net";
const response = await fetch(process.env.TITAN_FAKE_ORIGIN);
if (await response.text() !== "loopback fake") throw new Error("Loopback unavailable");
await new Promise((done, fail) => {
  const timer = setTimeout(() => { socket.destroy(); fail(new Error("Expected immediate OS route denial")); }, 1000);
  const socket = connect({host:"1.1.1.1",port:80});
  socket.once("connect", () => { clearTimeout(timer); socket.destroy(); fail(new Error("External connection escaped")); });
  socket.once("error", (error) => { clearTimeout(timer); if (!["ENETUNREACH","EHOSTUNREACH","ECONNREFUSED"].includes(error.code)) fail(error); else done(); });
});
console.log("loopback available; external route denied");
`;
async function run(
  args: string[],
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", env });
  const [out, err] = await all([
    () => new Response(child.stdout).text(),
    () => new Response(child.stderr).text(),
  ]);
  const code = await child.exited;
  expect(code, err).toBe(0);
  return out + err;
}
export const isolatedDefaultProcess = () => {
  expect(
    Object.values(networkInterfaces())
      .flat()
      .every((address) => address?.internal),
  ).toBe(true);
  expect(Object.keys(process.env).some((key) => /_API_KEY$|_TOKEN$|^TITAN_LIVE_/.test(key))).toBe(
    false,
  );
  expect(() => fetch("https://api.openai.com")).toThrow("network blocked in tests");
  expect(() => Bun.spawn(["codex", "exec", "never run"])).toThrow("process blocked in tests");
  expect(() => Bun.spawnSync(["sh", "-c", "codex exec never"])).toThrow("process blocked in tests");
};
export const isolatedChildProcess = async () => {
  const local = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("loopback fake"),
  });
  try {
    expect(
      await run([process.execPath, "-e", probe], {
        ...process.env,
        TITAN_FAKE_ORIGIN: `http://127.0.0.1:${local.port}`,
      }),
    ).toContain("external route denied");
  } finally {
    await local.stop(true);
  }
};
export const isolatedGitHook = async () => {
  const project = await mkdtemp(resolve(tmpdir(), "titan-git-isolation-"));
  const local = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("loopback fake"),
  });
  try {
    await run(["git", "init", project]);
    const hooks = resolve(project, ".git/hooks");
    await mkdir(hooks, { recursive: true });
    const hook = resolve(hooks, "post-commit");
    await writeFile(hook, `#!${process.execPath}\n${probe}`);
    await chmod(hook, 0o755);
    const output = await run(
      [
        "git",
        "-C",
        project,
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        "test: isolated hook",
      ],
      { ...process.env, TITAN_FAKE_ORIGIN: `http://127.0.0.1:${local.port}` },
    );
    expect(output).toContain("external route denied");
  } finally {
    await local.stop(true);
    await rm(project, { recursive: true, force: true });
  }
};
export const guardRemovesKeys = () => {
  expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  expect(process.env.OPENAI_API_KEY).toBeUndefined();
  expect(process.env.RUNPOD_API_KEY).toBeUndefined();
  expect(process.env.TITAN_LIVE_RUNPOD).toBeUndefined();
};
export const guardBlocksVendorFetch = () => {
  expect(() => fetch("https://api.anthropic.com/v1/messages")).toThrow(
    "network blocked in tests: api.anthropic.com",
  );
};
export const guardBlocksNodeNetwork = () => {
  expect(() => https.get("https://example.com/")).toThrow("network blocked in tests");
  expect(() => httpGet("http://example.com/")).toThrow("network blocked in tests");
  expect(() => connect({ host: "example.com", port: 80 })).toThrow("network blocked in tests");
  expect(() => Bun.connect({ hostname: "example.com", port: 80, socket: {} as never })).toThrow(
    "network blocked in tests",
  );
};
export const guardBlocksUnknownHost = () => {
  expect(() => connect(undefined as never)).toThrow("network blocked in tests: unknown");
};
export const guardBlocksAgentPrograms = () => {
  expect(() => Bun.spawn(["claude", "--version"])).toThrow("process blocked in tests: claude");
  expect(() => Bun.spawn(["codex", "--version"])).toThrow("process blocked in tests: codex");
};
export const guardBlocksShellEscape = () => {
  expect(() => execSync("curl https://example.com/")).toThrow("process blocked in tests");
  expect(() => execSync("bun -e 1; curl https://example.com/")).toThrow("process blocked in tests");
};
export const guardAllowsLoopback = async () => {
  const local = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("served") });
  try {
    expect(await (await fetch(`http://127.0.0.1:${local.port}`)).text()).toBe("served");
  } finally {
    await local.stop(true);
  }
};
export const guardAllowsFakeAgent = async () => {
  expect(await run([process.execPath, agentFixture])).toContain("scripted fake agent answer");
};
