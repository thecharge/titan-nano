import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FileEncoding, IoLimit, ProcessIo } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { exists } from "@titan/workspace";
import { withTemporaryDirectory } from "../../../../../testing/packages/framework/src/files.ts";

const binary = process.argv[2];
assert.ok(binary);
await withTemporaryDirectory(async (root) => {
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await mkdir(home);
  await mkdir(resolve(project, ".codex"), { recursive: true });
  const homeMarker = resolve(root, "home-started");
  const projectMarker = resolve(root, "project-started");
  const credential = "synthetic-offline-probe";
  await writeFile(
    resolve(home, "auth.json"),
    Buffer.from(
      JSON.stringify({
        auth_mode: "apikey",
        OPENAI_API_KEY: credential,
      }),
    ),
    { mode: 0o600 },
  );
  await writeFile(
    resolve(home, "config.toml"),
    Buffer.from(
      `[mcp_servers.home_fixture]\ncommand = "/bin/sh"\nargs = ["-c", "touch ${homeMarker}; exit 1"]\n[projects."${project}"]\ntrust_level = "trusted"\n`,
    ),
  );
  await writeFile(
    resolve(project, ".codex/config.toml"),
    Buffer.from(
      `[mcp_servers.project_fixture]\ncommand = "/bin/sh"\nargs = ["-c", "touch ${projectMarker}; exit 1"]\n`,
    ),
  );
  let calls = 0;
  let authenticated = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.body) await readBytes(request.body, IoLimit.ResponseBytes);
      calls++;
      if (request.headers.get("authorization") === `Bearer ${credential}`) authenticated++;
      return Response.json(
        { error: { message: "deliberate offline probe refusal", type: "probe" } },
        { status: 400 },
      );
    },
  });
  try {
    for (const ignore of [false, true]) {
      await rm(homeMarker, { force: true });
      await rm(projectMarker, { force: true });
      const before = calls;
      const beforeAuth = authenticated;
      const args = [
        "exec",
        "--experimental-json",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "-c",
        'model="probe-model"',
        "-c",
        'model_provider="openai"',
        "-c",
        `openai_base_url="http://127.0.0.1:${server.port}/v1"`,
        "-c",
        'cli_auth_credentials_store="file"',
        "-c",
        `projects."${project}".trust_level="trusted"`,
        "-c",
        'web_search="disabled"',
      ];
      if (ignore) args.push("--ignore-user-config");
      args.push("Report the probe refusal");
      const child = Bun.spawn([binary, ...args], {
        cwd: project,
        env: { ...process.env, HOME: root, CODEX_HOME: home, OPENAI_API_KEY: undefined },
        stdin: ProcessIo.Ignore,
        stdout: ProcessIo.Pipe,
        stderr: ProcessIo.Pipe,
        timeout: 15000,
      });
      try {
        const [output, error] = await all(
          [
            () => readBytes(child.stdout, IoLimit.ResponseBytes),
            () => readBytes(child.stderr, IoLimit.ResponseBytes),
          ],
          2,
        );
        const status = await child.exited;
        const homeStarted = await exists(homeMarker);
        const projectStarted = await exists(projectMarker);
        assert.equal(status, 1, error.toString(FileEncoding.Utf8));
        assert.equal(homeStarted, !ignore);
        assert.equal(projectStarted, !ignore);
        assert.ok(calls > before, error.toString(FileEncoding.Utf8));
        assert.equal(authenticated - beforeAuth, calls - before);
        assert.ok(output.toString(FileEncoding.Utf8).includes('"type":"turn.failed"'));
        console.log(
          JSON.stringify({
            ignore,
            status,
            homeStarted,
            projectStarted,
            calls: calls - before,
            authenticated: authenticated - beforeAuth,
          }),
        );
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
        await child.exited;
      }
    }
  } finally {
    await server.stop(true);
  }
});
