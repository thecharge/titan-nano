import { strict as assert } from "node:assert";
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  readdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { validateConfigDocument } from "@titan/config";
import { type ConfigScope, ConfigWrite, UpdatePolicy } from "@titan/constants";
import { captureCommand } from "@titan/process";
import { processExited, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { UpdateCacheSchema, UpdateSettingsSchema } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import {
  checkUpdateNotice,
  compareRelease,
  inspectLatestRelease,
  newestRelease,
  releaseVersion,
} from "../../apps/cli/src/updates.ts";
import { captureCli } from "../support/command.ts";

export function releaseComparison(left: string, right: string) {
  const a = releaseVersion(left);
  const b = releaseVersion(right);
  return a && b ? compareRelease(a, b) : null;
}

export function releaseTags(versions: string[], current: string) {
  return newestRelease(versions.join("\n"), current);
}

export function validUpdateSettings(value: unknown) {
  return UpdateSettingsSchema.safeParse(value).success;
}

export async function updateOwnerSettings(value: unknown, scope: ConfigScope) {
  return withTemporaryDirectory(async (home) => {
    const config = await validateConfigDocument(value, scope, home);
    return config.value.update ?? null;
  });
}

export async function updateNoticeLifecycle(kind: string) {
  return withTemporaryDirectory(async (home) => {
    const path = resolve(home, "config.yaml");
    const cachePath = resolve(home, UpdatePolicy.CacheFile);
    const settings = { update: { source: "https://example.com/releases.git", check: "daily" } };
    if (kind === "never") settings.update.check = "never";
    if (kind !== "missing") await writeFile(path, JSON.stringify(settings));
    if (kind === "invalid") await writeFile(path, "[");
    if (kind === "corrupt-cache") await writeFile(cachePath, "[");
    let count = 0;
    let now = 100000000;
    const services = {
      now: () => now,
      async tags(source: string, cwd: string) {
        assert.equal(source, settings.update.source);
        assert.equal(cwd, home);
        count++;
        if (kind === "failure") throw new Error("Unavailable source");
        return `${"a".repeat(40)}\trefs/tags/v1.2.0`;
      },
    };
    const first = await checkUpdateNotice(home, "1.0.0", services);
    const second = await checkUpdateNotice(home, "1.0.0", services);
    if (["missing", "never", "invalid"].includes(kind)) {
      assert.equal(count, 0);
      assert.equal(first, null);
      assert.equal(second, null);
      assert.equal((await readdir(home)).includes(UpdatePolicy.CacheFile), false);
      return true;
    }
    assert.equal(count, 1);
    assert.equal(second, first);
    const cached = UpdateCacheSchema.parse(JSON.parse((await readFile(cachePath)).toString()));
    assert.equal(cached.checked_at, now);
    if (kind === "failure") assert.equal(first, null);
    else assert.equal(first, "Titan 1.2.0 is available. Run titan update --check.");
    if (kind === "daily") now += UpdatePolicy.DayMilliseconds;
    if (kind === "future") now -= 1;
    if (kind === "source") {
      settings.update.source = "https://example.com/other.git";
      await writeFile(path, JSON.stringify(settings));
    }
    if (["daily", "future", "source"].includes(kind)) {
      await checkUpdateNotice(home, "1.0.0", services);
      assert.equal(count, 2);
    }
    assert.equal(await checkUpdateNotice(home, "2.0.0", services), null);
    return true;
  });
}

export async function updateConcurrentNotice(fails: boolean, version: string) {
  return withTemporaryDirectory(async (home) => {
    await writeFile(resolve(home, "config.yaml"), JSON.stringify({ update: { source: "local" } }));
    let release = () => {};
    let enter = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    let calls = 0;
    const services = {
      now: () => 100,
      async tags() {
        calls++;
        enter();
        await pending;
        if (fails) throw new Error("Offline");
        return `${"a".repeat(40)}\trefs/tags/2.0.0`;
      },
    };
    const first = checkUpdateNotice(home, version, services);
    await entered;
    try {
      assert.equal(await checkUpdateNotice(home, version, services), null);
    } finally {
      release();
    }
    await first;
    await checkUpdateNotice(home, version, services);
    assert.equal(calls, 1);
    return true;
  });
}

export async function updateReadOnlyCheck(disabled: boolean, empty: boolean) {
  return withTemporaryDirectory(async (home) => {
    if (!empty)
      await writeFile(
        resolve(home, "config.yaml"),
        JSON.stringify({ update: { source: "local", check: disabled ? "never" : "daily" } }),
      );
    const before = await readdir(home);
    let queries = 0;
    const result = await inspectLatestRelease(home, "1.0.0", {
      now: Date.now,
      async tags() {
        queries++;
        return `${"a".repeat(40)}\trefs/tags/2.0.0`;
      },
    });
    assert.equal(queries, disabled || empty ? 0 : 1);
    assert.equal(result.checked, !disabled && !empty);
    assert.equal(result.available_version, disabled || empty ? null : "2.0.0");
    assert.deepEqual(await readdir(home), before);
    return true;
  });
}

export async function updateCommandNotice(json: boolean, available: boolean) {
  return withTemporaryDirectory(async (home) => {
    const data: unknown[] = [];
    const notices: string[] = [];
    let checks = 0;
    const cli = createCli({
      ...defaultServices,
      output: (value) => data.push(value),
      notice: (value) => notices.push(value),
      async updateNotice(selectedHome, version) {
        assert.equal(selectedHome, home);
        assert.equal(version, defaultServices.version);
        checks++;
        return available ? "Titan 2.0.0 is available. Run titan update --check." : null;
      },
    });
    const args = ["config", "--json"];
    if (!json) args.pop();
    args.push("--home", home, "--project", home);
    await cli(args);
    assert.equal(checks, 1);
    assert.equal(data.length, 1);
    assert.equal(notices.length, Number(available));
    return true;
  });
}

export async function updateGitCheck(tag: string, expected: string | null) {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, "home");
    const repository = resolve(directory, "release repository");
    await mkdir(home);
    await mkdir(repository);
    const commands = [
      ["git", "init", "--bare", repository],
      ["git", "-C", repository, "hash-object", "-w", "--stdin"],
    ];
    const initialized = await captureCommand(commands[0] ?? [], directory);
    assert.equal(initialized.exit_code, 0);
    const hashed = await captureCommand(commands[1] ?? [], directory);
    assert.equal(hashed.exit_code, 0);
    const updated = await captureCommand(
      ["git", "-C", repository, "update-ref", `refs/tags/${tag}`, hashed.stdout.toString().trim()],
      directory,
    );
    assert.equal(updated.exit_code, 0);
    await writeFile(
      resolve(home, "config.yaml"),
      JSON.stringify({ update: { source: repository } }),
    );
    const before = await readdir(home);
    const result = await inspectLatestRelease(home, "1.0.0");
    assert.equal(result.available_version, expected);
    assert.equal(result.checked, true);
    assert.deepEqual(await readdir(home), before);
    const results: unknown[] = [];
    const cli = createCli({ ...defaultServices, output: (value) => results.push(value) });
    assert.equal(await cli(["update", "--check", "--home", home, "--json"]), 0);
    assert.equal(results.length, 1);
    assert.deepEqual(await readdir(home), before);
    const command = await captureCli(resolve(import.meta.dir, "../../apps/cli/src/main.ts"), [
      "update",
      "--check",
      "--home",
      home,
      "--json",
    ]);
    assert.equal(command.code, 0);
    assert.equal(command.error.toString(), "");
    const envelope = JSON.parse(command.output.toString());
    assert.equal(envelope.data.checked, true);
    assert.deepEqual(await readdir(home), before);
    const normal = await captureCli(resolve(import.meta.dir, "../../apps/cli/src/main.ts"), [
      "config",
      "--home",
      home,
      "--project",
      home,
      "--json",
    ]);
    assert.equal(normal.code, 0);
    assert.ok(JSON.parse(normal.output.toString()).data);
    assert.equal(normal.error.toString().trim().split("\n").length, 1);
    assert.equal(
      normal.error.toString().includes("titan update --check"),
      tag !== "release-candidate",
    );
    return true;
  });
}

export async function updateUnavailableSource(kind: string) {
  return withTemporaryDirectory(async (home) => {
    const path = resolve(home, "config.yaml");
    const source = kind === "file" ? path : resolve(home, "missing");
    const config = Buffer.from(
      JSON.stringify({ update: { source, check: kind === "disabled" ? "never" : "daily" } }),
    );
    await writeFile(path, config);
    if (kind === "cached-failure")
      await writeFile(
        resolve(home, UpdatePolicy.CacheFile),
        JSON.stringify({ source, checked_at: 1, latest: "2.0.0" }),
      );
    const before = await readdir(home);
    if (kind === "disabled") {
      assert.equal((await inspectLatestRelease(home, "1.0.0")).checked, false);
      assert.equal(await checkUpdateNotice(home, "1.0.0"), null);
      assert.deepEqual(await readdir(home), before);
      return true;
    }
    await assert.rejects(
      () => inspectLatestRelease(home, "1.0.0"),
      /release source could not be checked/,
    );
    assert.deepEqual(await readdir(home), before);
    const notice = await checkUpdateNotice(home, "1.0.0");
    assert.equal(
      notice,
      kind === "cached-failure" ? "Titan 2.0.0 is available. Run titan update --check." : null,
    );
    const cache = UpdateCacheSchema.parse(
      JSON.parse((await readFile(resolve(home, UpdatePolicy.CacheFile))).toString()),
    );
    assert.equal(cache.source, source);
    assert.equal(cache.latest, kind === "cached-failure" ? "2.0.0" : null);
    assert.deepEqual(await readFile(path), config);
    return true;
  });
}

export async function updateQueryDeadline(check: boolean, json: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const bin = resolve(root, "bin");
    const record = resolve(root, "processes.txt");
    await mkdir(home);
    await mkdir(bin);
    await copyFile(resolve(import.meta.dir, "../fixtures/update-git.sh"), resolve(bin, "git"));
    await chmod(resolve(bin, "git"), 0o755);
    await writeFile(resolve(home, "config.yaml"), JSON.stringify({ update: { source: "local" } }));
    const args = check ? ["update", "--check"] : ["config", "--project", root];
    args.push("--home", home);
    if (json) args.push("--json");
    const started = performance.now();
    const result = await captureCli(
      resolve(import.meta.dir, "../../apps/cli/src/main.ts"),
      args,
      root,
      { ...process.env, PATH: `${bin}:/usr/bin:/bin`, TITAN_TEST_GIT_RECORD: record },
    );
    assert.ok(performance.now() - started < UpdatePolicy.TimeoutMilliseconds + 1000);
    const pids = (await readFile(record)).toString().trim().split("\n").map(Number);
    assert.equal(pids.length, 2);
    for (const pid of pids) assert.ok(await waitUntil(() => processExited(pid)));
    if (check) {
      assert.notEqual(result.code, 0);
      assert.ok(Buffer.concat([result.output, result.error]).toString().includes("deadline"));
      assert.deepEqual((await readdir(home)).sort(), ["config.yaml"]);
    } else {
      assert.equal(result.code, 0);
      assert.equal(result.error.toString(), "");
      const cache = UpdateCacheSchema.parse(
        JSON.parse((await readFile(resolve(home, UpdatePolicy.CacheFile))).toString()),
      );
      assert.equal(cache.latest, null);
    }
    if (json) assert.ok(JSON.parse(result.output.toString()));
    return true;
  });
}

export async function updateNoticeLease(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, "home");
    await mkdir(home);
    await writeFile(resolve(home, "config.yaml"), JSON.stringify({ update: { source: "local" } }));
    const external = resolve(directory, "external.db");
    const database = new Bun.SQL({ adapter: "sqlite", filename: external });
    await database.unsafe("CREATE TABLE retained (value TEXT)");
    await database.close();
    await chmod(external, 0o644);
    const before = await readFile(external);
    const path = resolve(home, UpdatePolicy.CacheFile + ConfigWrite.LockSuffix);
    const unsafe = mode !== "plain" && mode !== "plain-existing";
    if (mode === "plain-existing") await copyFile(external, path);
    if (unsafe) {
      const target = path + (mode.includes("companion") ? "-journal" : "");
      if (mode.startsWith("hard")) await link(external, target);
      else await symlink(external, target);
    }
    let queries = 0;
    const notice = await checkUpdateNotice(home, "1.0.0", {
      now: () => 100,
      async tags() {
        queries++;
        return `${"a".repeat(40)}\trefs/tags/v2.0.0`;
      },
    });
    assert.equal(queries, unsafe ? 0 : 1);
    assert.equal(notice, unsafe ? null : "Titan 2.0.0 is available. Run titan update --check.");
    assert.deepEqual(await readFile(external), before);
    assert.equal((await lstat(external)).mode & 0o777, 0o644);
    if (!unsafe) assert.equal((await lstat(path)).mode & 0o777, 0o600);
    return true;
  });
}
