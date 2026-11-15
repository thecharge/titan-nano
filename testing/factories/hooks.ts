import { mkdir, readFile, realpath, symlink, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  BoundaryReadLimit,
  DependencyReadFixture,
  HookCheckCommands,
  HookLimit,
  HookRevisionFixture,
  HookSnapshotFixture,
} from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { exists } from "@titan/workspace";
import { checkHookSnapshot } from "../../tooling/scripts/hook-checks.ts";
import { linkOutgoingDependencies } from "../../tooling/scripts/hook-dependencies.ts";
import { commandOutput, verificationCommandStatus } from "../../tooling/scripts/hook-process.ts";
import { outgoingCommits } from "../../tooling/scripts/hook-revisions.ts";
import { checkCommitMessage, scanSnapshotFiles } from "../../tooling/scripts/hook-secrets.ts";
import { withGitSnapshot } from "../../tooling/scripts/hook-snapshot.ts";
import { readCommitMessage } from "../../tooling/scripts/message-command.ts";
import { hookPolicyFixture } from "../cases/hook-policy.ts";

async function git(root: string, ...args: string[]): Promise<string> {
  return commandOutput(["git", ...args], { cwd: root });
}

async function initialize(root: string): Promise<void> {
  await git(root, "init", "--initial-branch=main");
  await writeFile(join(root, "entry.txt"), Buffer.from("staged"));
  await git(root, "add", "entry.txt");
}

export async function snapshotIsolation(mode: HookSnapshotFixture): Promise<unknown> {
  return withTemporaryDirectory(async (root) => {
    await initialize(root);
    if (mode === HookSnapshotFixture.StagedDeletion) {
      await unlink(join(root, "entry.txt"));
      await git(root, "add", "--all");
    }
    if (mode === HookSnapshotFixture.SymbolicLink) {
      await symlink("/etc/passwd", join(root, "external"));
      await git(root, "add", "external");
    }
    const tree = await git(root, "write-tree");
    await writeFile(join(root, "entry.txt"), Buffer.from("unstaged"));
    let exported = "";
    const result = await withGitSnapshot(root, tree, async (snapshot) => {
      exported = snapshot;
      if (mode === HookSnapshotFixture.CallbackFailure) throw new Error("snapshot callback failed");
      return (await exists(join(snapshot, "entry.txt")))
        ? readFile(join(snapshot, "entry.txt"), "utf8")
        : null;
    });
    return {
      result,
      cleaned: !(await exists(exported)),
      indexUnchanged: tree === (await git(root, "write-tree")),
      working: await readFile(join(root, "entry.txt"), "utf8"),
    };
  });
}

async function revision(root: string, text: string, parent?: string): Promise<string> {
  await writeFile(join(root, "entry.txt"), Buffer.from(text));
  await git(root, "add", "entry.txt");
  const tree = await git(root, "write-tree");
  return git(
    root,
    "-c",
    "user.name=Titan Fixture",
    "-c",
    "user.email=titan@example.invalid",
    "commit-tree",
    tree,
    ...(parent ? ["-p", parent] : []),
    "-m",
    text,
  );
}

export async function dependencyIsolation(
  changedLock: boolean,
  installedVersion: string,
  workspace: boolean,
  mode: DependencyReadFixture = DependencyReadFixture.Normal,
  tip = true,
): Promise<unknown> {
  return withTemporaryDirectory(async (root) => {
    const snapshot = join(root, "snapshot");
    const owner = join(snapshot, "packages/owner");
    await mkdir(owner, { recursive: true });
    const cached = join(root, "node_modules/.bun/node_modules/vendor");
    await mkdir(cached, { recursive: true });
    await mkdir(join(root, "node_modules/.bin"), { recursive: true });
    await writeFile(
      join(cached, "package.json"),
      Buffer.from(
        JSON.stringify({
          name: "vendor",
          version: installedVersion,
          description:
            mode === DependencyReadFixture.CachedManifest
              ? "x".repeat(BoundaryReadLimit.ManifestBytes + 1)
              : "",
        }),
      ),
    );
    await writeFile(
      join(root, "bun.lock"),
      mode === DependencyReadFixture.RootLock
        ? Buffer.alloc(HookLimit.LockBytes + 1)
        : Buffer.from("installed lock"),
    );
    await writeFile(
      join(snapshot, "bun.lock"),
      mode === DependencyReadFixture.SnapshotLock
        ? Buffer.alloc(HookLimit.LockBytes + 1)
        : Buffer.from(changedLock ? "changed lock" : "installed lock"),
    );
    await writeFile(
      join(snapshot, "package.json"),
      JSON.stringify({
        name: "fixture",
        packageManager: `bun@${Bun.version}`,
        workspaces: { packages: ["packages/*"], catalog: {} },
        devDependencies: { "@fixture/owner": "workspace:*" },
      }),
    );
    await writeFile(
      join(owner, "package.json"),
      JSON.stringify({
        name: "@fixture/owner",
        dependencies: workspace ? {} : { vendor: "1.0.0" },
      }),
    );
    await linkOutgoingDependencies(root, snapshot, tip);
    if (!tip) {
      const linked = await realpath(join(snapshot, "node_modules"));
      const shared = linked === (await realpath(join(root, "node_modules")));
      return { local: shared, external: shared };
    }
    const local = await realpath(join(snapshot, "node_modules/@fixture/owner"));
    const external = workspace || (await realpath(join(owner, "node_modules/vendor"))) === cached;
    return { local: local === owner, external };
  });
}

export async function revisionInventory(mode: HookRevisionFixture): Promise<unknown> {
  return withTemporaryDirectory(async (root) => {
    await initialize(root);
    const base = await revision(root, "baseline");
    const first = await revision(root, "first outgoing defect", base);
    const last = await revision(root, "later fix", first);
    const local = mode === HookRevisionFixture.InvalidLocal ? "not-an-object" : last;
    const remote = mode === HookRevisionFixture.NewBranch ? "0".repeat(40) : base;
    const commits = await outgoingCommits(root, {
      localRef: "refs/heads/main",
      remoteRef: "refs/heads/main",
      localObject: mode === HookRevisionFixture.Deletion ? "0".repeat(40) : local,
      remoteObject: mode === HookRevisionFixture.MissingRemote ? "f".repeat(40) : remote,
    });
    return commits.map((id) => [base, first, last].indexOf(id));
  });
}

export async function prepareTools(directory: string): Promise<void> {
  await symlink(resolve(import.meta.dir, "../../node_modules"), join(directory, "node_modules"));
  await writeFile(
    join(directory, ".secretlintrc.json"),
    JSON.stringify({ rules: [{ id: "@secretlint/secretlint-rule-preset-recommend" }] }),
  );
  await writeFile(
    join(directory, ".commitlintrc.json"),
    JSON.stringify({ extends: ["@commitlint/config-conventional"] }),
  );
}

export async function secretFileVerification(filename: string, secret: boolean): Promise<number> {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    await writeFile(join(directory, ".gitignore"), Buffer.from(".env\n"));
    await writeFile(
      join(directory, filename),
      Buffer.from(secret ? await syntheticCredential() : "ordinary fixture content"),
    );
    return scanSnapshotFiles(directory, [filename]);
  });
}

export async function commitMessageVerification(message: string, secret: boolean): Promise<number> {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    const suffix = secret ? `\n\n${await syntheticCredential()}` : "";
    const body = `${message}${suffix}`;
    return checkCommitMessage(directory, Buffer.from(body));
  });
}

export async function syntheticCredential(): Promise<string> {
  return `AWS_SECRET_ACCESS_KEY=${"A".repeat(40)}`;
}

export async function gateOutcome(
  failingStage: string | null,
  filename: string,
  secret: boolean,
): Promise<unknown> {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    await writeFile(join(directory, "lefthook.yml"), Bun.YAML.stringify(hookPolicyFixture));
    await writeFile(
      join(directory, filename),
      Buffer.from(secret ? await syntheticCredential() : "ordinary content"),
    );
    let stages = 0;
    const code = await checkHookSnapshot(
      directory,
      [filename],
      async (command) => {
        stages++;
        return command.includes(failingStage ?? "never") ? 1 : 0;
      },
      () => undefined,
    );
    return { code, complete: stages === HookCheckCommands.length, stages };
  });
}

export async function messageFileBytes(size: number, present: boolean): Promise<number> {
  return withTemporaryDirectory(async (directory) => {
    const file = join(directory, "message.txt");
    if (present) await writeFile(file, Buffer.alloc(size));
    return (await readCommitMessage(file)).byteLength;
  });
}

export async function hookVerificationEnvironment(fast: string | undefined, failure = 0) {
  return withTemporaryDirectory((directory) =>
    verificationCommandStatus(
      [process.execPath, "-e", `process.exit(process.env.TITAN_TEST_FAST ? 99 : ${failure})`],
      directory,
      { ...process.env, TITAN_TEST_FAST: fast },
    ),
  );
}
