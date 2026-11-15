import { strict as assert } from "node:assert";
import { chmod, copyFile, mkdir, readFile, readlink, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ErrorField, MissingProcessCode, ProcessSignal } from "@titan/constants";
import { ownMaintenance } from "@titan/server/maintenance";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { exists } from "@titan/workspace";

const Shell = resolve(import.meta.dir, "../fixtures/run-shell.sh");
const Script = resolve(import.meta.dir, "../../install.sh");
const BunLink = "bun";
const RefusedCode = 2;

function stopBuild(pid: number): void {
  try {
    process.kill(pid, ProcessSignal.Kill);
  } catch (error) {
    if (!(error instanceof Error && Reflect.get(error, ErrorField.Code) === MissingProcessCode))
      throw error;
  }
}

export async function startScript(script: string | null, withBun: boolean) {
  return withTemporaryDirectory(async (empty) => {
    if (withBun) await symlink(process.execPath, resolve(empty, BunLink));
    const child = Bun.spawn([Shell, script ?? Script], {
      env: { PATH: empty, HOME: empty },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(child.stdout).text();
    assert.equal(await child.exited, RefusedCode);
    return {
      namesBun: out.includes("bun"),
      namesGit: out.includes("git"),
      offersFlag: out.includes("--install-bun"),
    };
  });
}

export async function installBootstrap(scenario: string) {
  return withTemporaryDirectory(async (root) => {
    await using ownership = new AsyncDisposableStack();
    const source = resolve(root, "source tree");
    const bin = resolve(root, "bin");
    const target = resolve(root, scenario === "default" ? "titan" : "installed tool");
    const record = resolve(root, "doctor.txt");
    const project = resolve(source, "selected project");
    const command = resolve(root, ".local/bin/titan");
    await mkdir(source);
    await mkdir(project);
    await mkdir(resolve(source, "dist"));
    await writeFile(resolve(source, "dist/titan-cli-old.tgz"), "retained archive");
    await mkdir(bin);
    await mkdir(target);
    await copyFile(Script, resolve(source, "install.sh"));
    await symlink(resolve(import.meta.dir, "../../tooling"), resolve(source, "tooling"));
    await copyFile(resolve(import.meta.dir, "../fixtures/install-bun.sh"), resolve(bin, "bun"));
    await chmod(resolve(bin, "bun"), 0o755);
    await symlink("/bin/true", resolve(bin, "git"));
    const manifest =
      scenario === "fresh" ? '{"private":true}\n' : '{"private":true,"name":"keep-me"}';
    if (scenario !== "fresh") await writeFile(resolve(target, "package.json"), manifest);
    if (scenario === "collision") await writeFile(resolve(target, "titan"), "user file");
    if (scenario === "command-file" || scenario === "command-link") {
      await mkdir(resolve(root, ".local/bin"), { recursive: true });
      if (scenario === "command-file") await writeFile(command, "user command");
      else await symlink(resolve(root, "another-command"), command);
    }
    if (scenario === "held-install") await ownMaintenance(target, ownership);
    if (scenario === "stale-install") await mkdir(resolve(target, ".install-lock"));
    if (scenario === "linked-releases") await symlink(source, resolve(target, "releases"));
    if (scenario === "legacy" || scenario === "killed-reinstall") {
      await mkdir(resolve(target, "node_modules/.bin"), { recursive: true });
      await copyFile(
        resolve(import.meta.dir, "../fixtures/install-doctor.sh"),
        resolve(target, "node_modules/.bin/titan"),
      );
      await symlink("node_modules/.bin/titan", resolve(target, "titan"));
    }
    const args = scenario === "default" ? [] : [target];
    if (scenario === "unknown-option") args.push("--unknown");
    if (scenario === "multiple-targets") args.push(resolve(root, "another"));
    if (scenario.startsWith("setup-") && scenario !== "setup-invalid")
      args.push(
        "--harness",
        scenario === "setup-both" ? "both" : scenario === "setup-claude" ? "claude" : "codex",
      );
    if (scenario === "setup-both" || scenario === "setup-failure")
      args.push("--project", "selected project");
    if (scenario === "setup-invalid") args.push("--harness", "unknown");
    if (scenario === "missing-harness") args.push("--harness");
    if (scenario === "project-without-harness") args.push("--project", project);
    if (scenario === "missing-project") args.push("--harness", "codex", "--project", "absent");
    if (scenario === "repeated-harness") args.push("--harness", "codex", "--harness", "claude");
    if (scenario === "relative-target") args[0] = "../installed tool";
    const options = {
      cwd: source,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: root,
        TITAN_TEST_BUN_VERSION: scenario === "invalid-version" ? "invalid" : "1.3.10",
        TITAN_TEST_INSTALL_CASE: scenario,
        TITAN_TEST_INSTALL_DOCTOR: resolve(import.meta.dir, "../fixtures/install-doctor.sh"),
        TITAN_TEST_INSTALL_RECORD: record,
        TITAN_TEST_INSTALL_RUNTIME: process.execPath,
      },
      stdout: "ignore" as const,
      stderr: "ignore" as const,
    };
    const child = Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options);
    if (scenario === "concurrent") {
      const second = resolve(root, "second installation");
      const concurrent = Bun.spawn([Shell, resolve(source, "install.sh"), second], {
        ...options,
        env: { ...options.env, TITAN_TEST_INSTALL_RECORD: `${record}.second` },
      });
      assert.equal(await concurrent.exited, 0);
      assert.ok(await readFile(resolve(second, await readlink(resolve(second, "titan")))));
      assert.equal(await readFile(`${record}.second`, "utf8"), `${second}\ndoctor\n`);
    }
    if (scenario === "killed-install" || scenario === "killed-reinstall") {
      let build: number | undefined;
      try {
        assert.ok(await waitUntil(() => exists(record)));
        build = Number(await readFile(record, "utf8"));
        const previous = await readlink(resolve(target, "titan")).catch(() => null);
        const blocked = Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options);
        assert.equal(await blocked.exited, 2);
        child.kill(ProcessSignal.Kill);
        await child.exited;
        assert.equal(await readlink(resolve(target, "titan")).catch(() => null), previous);
        options.env.TITAN_TEST_INSTALL_CASE = "fresh";
      } finally {
        if (child.exitCode === null) child.kill(ProcessSignal.Kill);
        await child.exited;
        if (build) stopBuild(build);
      }
    }
    let code = scenario.startsWith("killed-")
      ? await Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options).exited
      : await child.exited;
    assert.equal(
      await readFile(resolve(source, "dist/titan-cli-old.tgz"), "utf8"),
      "retained archive",
    );
    if (scenario === "repeat" && code === 0) {
      const before = await readlink(resolve(target, "titan"));
      code = await Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options).exited;
      assert.notEqual(await readlink(resolve(target, "titan")), before);
      assert.ok(await readFile(resolve(target, before)));
    }
    if (scenario === "repeat-failure" && code === 0) {
      const before = await readlink(resolve(target, "titan"));
      options.env.TITAN_TEST_INSTALL_CASE = "doctor-failure";
      code = await Bun.spawn([Shell, resolve(source, "install.sh"), ...args], options).exited;
      assert.equal(await readlink(resolve(target, "titan")), before);
      assert.ok(await readFile(resolve(target, before)));
    }
    assert.equal(await readFile(resolve(target, "package.json"), "utf8"), manifest);
    if (scenario.startsWith("setup-") && scenario !== "setup-invalid") {
      const selected = scenario === "setup-both" || scenario === "setup-failure" ? project : source;
      const agents =
        scenario === "setup-both"
          ? ["codex", "claude"]
          : [scenario === "setup-claude" ? "claude" : "codex"];
      assert.equal(
        await readFile(`${record}.setup`, "utf8"),
        agents
          .map((agent) => `${source}\ninstall\n--harness\n${agent}\n--project\n${selected}\n`)
          .join(""),
      );
      assert.ok(await readFile(resolve(target, await readlink(resolve(target, "titan")))));
    }
    if (scenario === "collision")
      assert.equal(await readFile(resolve(target, "titan"), "utf8"), "user file");
    if (code !== 0 && scenario !== "repeat-failure") {
      if (scenario === "doctor-failure" || scenario === "add-failure")
        await assert.rejects(readlink(resolve(target, "titan")), { code: "ENOENT" });
      return { code, preserved: true };
    }
    assert.match(
      await readlink(resolve(target, "titan")),
      /^releases\/titan-cli-test\.[^/]+\/node_modules\/\.bin\/titan$/,
    );
    assert.equal(await readFile(record, "utf8"), `${target}\ndoctor\n`);
    const guide = Bun.spawn(
      [
        Shell,
        scenario === "fresh" || scenario === "default" ? command : resolve(target, "titan"),
        "guide",
      ],
      {
        cwd: source,
        env: { TITAN_TEST_INSTALL_RECORD: record },
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    assert.equal(await guide.exited, 0);
    assert.equal(await readFile(record, "utf8"), `${source}\nguide\n`);
    if (scenario === "command-file") assert.equal(await readFile(command, "utf8"), "user command");
    else if (scenario === "command-link")
      assert.equal(await readlink(command), resolve(root, "another-command"));
    else if (scenario !== "concurrent")
      assert.equal(await readlink(command), resolve(target, "titan"));
    return { code, preserved: true };
  });
}
