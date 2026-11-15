import { expect } from "bun:test";
import { link, mkdir, readFile, realpath, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { agentHostEnvironment } from "@titan/config";
import {
  AgentHost,
  AgentHostKind,
  Backend,
  ConfigDefault,
  ErrorCode,
  FileAccessMode,
  Packaging,
  ProcessIo,
  VendorFixture,
  VendorStubMode,
} from "@titan/constants";
import { claimHostFiles, hostedTurn } from "@titan/runtime";
import { agentSpec } from "@titan/test-factories";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { AgentSpec, SdkProbePaths } from "@titan/types";

export async function hostFileClaims(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    await using first = new AsyncDisposableStack();
    await using second = new AsyncDisposableStack();
    const a = agentSpec(root);
    const b = agentSpec(root);
    a.file_scope = { mode: FileAccessMode.Write, paths: ["src/one.txt"] };
    b.file_scope = { mode: FileAccessMode.Write, paths: ["src/two.txt"] };
    if (mode.startsWith("mixed-")) {
      a.file_scope.read_paths = [mode === "mixed-root" ? "." : "dependencies"];
      b.file_scope.read_paths = ["dependencies"];
      if (mode === "mixed-read") b.file_scope.mode = FileAccessMode.Read;
      if (mode === "mixed-write") b.file_scope.paths = ["dependencies/file.txt"];
      if (mode === "mixed-parent") b.file_scope.paths = ["."];
      if (mode === "mixed-later") {
        a.file_scope.paths = ["dependencies/file.txt"];
        a.file_scope.read_paths = ["other"];
      }
    }
    if (mode === "readers" || mode === "parent-read") {
      a.file_scope.mode = FileAccessMode.Read;
      b.file_scope = { mode: FileAccessMode.Read, paths: ["src/one.txt"] };
      if (mode === "parent-read") a.file_scope.paths = ["src"];
    }
    if (mode === "same" || mode === "alias") b.file_scope.paths = ["src/one.txt"];
    if (mode === "parent-write") b.file_scope.paths = ["src"];
    if (mode === "child-write") a.file_scope.paths = ["src"];
    if (["parent-reader", "root-reader", "root-read"].includes(mode)) {
      a.file_scope = { mode: FileAccessMode.Read, paths: [mode === "parent-reader" ? "src" : "."] };
      if (mode === "root-read") b.file_scope.mode = FileAccessMode.Read;
    }
    if (mode === "later-parent-reader")
      b.file_scope = { mode: FileAccessMode.Read, paths: ["src"] };
    if (mode === "child-reader") {
      a.file_scope.mode = FileAccessMode.Read;
      b.file_scope.paths = ["src"];
    }
    if (mode === "later-child-reader") {
      a.file_scope.paths = ["src"];
      b.file_scope.mode = FileAccessMode.Read;
    }
    if (mode === "unscoped") delete b.file_scope;
    if (mode === "alias") {
      const alias = resolve(root, ".titan-alias");
      await symlink(root, alias);
      b.cwd = alias;
    }
    await claimHostFiles(a, first);
    const failure = await thrownBy(() => claimHostFiles(b, second));
    if (
      [
        "independent",
        "readers",
        "parent-read",
        "root-read",
        "mixed-independent",
        "mixed-read",
      ].includes(mode)
    )
      expect(failure).toBeUndefined();
    else {
      expect(failure).toMatchObject({ code: "execution_interrupted" });
      await first.disposeAsync();
      await claimHostFiles(b, second);
    }
    return true;
  });
}

export async function hostFilePathGuard(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const outside = resolve(root, "outside");
    await mkdir(project);
    await mkdir(outside);
    await using resources = new AsyncDisposableStack();
    const spec = agentSpec(project);
    spec.file_scope = { mode: FileAccessMode.Write, paths: ["one.txt"] };
    const owner = resolve(project, AgentHost.Directory);
    if (mode === "root") await symlink(outside, owner);
    else if (mode === "claims") {
      await mkdir(owner);
      await symlink(outside, resolve(owner, AgentHost.ClaimsDirectory));
    }
    const failure = await thrownBy(() => claimHostFiles(spec, resources));
    if (mode === "root" || mode === "claims") expect(failure).toBeInstanceOf(Error);
    else expect(failure).toBeUndefined();
    return true;
  });
}

export async function hostFileRecovery(crash: boolean, leaf: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const ready = Promise.withResolvers<void>();
    const child = Bun.spawn(
      [process.execPath, "testing/fixtures/host-file-claims.mjs", root, leaf],
      {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
        ipc: () => ready.resolve(),
        serialization: "json",
      },
    );
    await using peer = new AsyncDisposableStack();
    await using replacement = new AsyncDisposableStack();
    const spec = agentSpec(root);
    spec.file_scope = { mode: FileAccessMode.Write, paths: [leaf] };
    const peerSpec = { ...spec, file_scope: { mode: FileAccessMode.Write, paths: ["peer.txt"] } };
    try {
      await Promise.race([
        ready.promise,
        child.exited.then(() => {
          throw new Error("Claim owner exited before readiness");
        }),
      ]);
      await claimHostFiles(peerSpec, peer);
      expect(await thrownBy(() => claimHostFiles(spec, replacement))).toMatchObject({
        code: "execution_interrupted",
      });
      if (crash) child.kill("SIGKILL");
      else child.send({ stop: true });
      const code = await child.exited;
      expect(code === 0).toBe(!crash);
      await claimHostFiles(spec, replacement);
      await using contender = new AsyncDisposableStack();
      expect(await thrownBy(() => claimHostFiles(peerSpec, contender))).toMatchObject({
        code: "execution_interrupted",
      });
      return true;
    } finally {
      child.kill();
      await child.exited;
    }
  });
}

export async function hostFileBounds(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const spec = agentSpec(root);
    spec.file_scope = { mode: FileAccessMode.Write, paths: ["one.txt"] };
    const owner = resolve(root, AgentHost.Directory);
    const claims = resolve(owner, AgentHost.ClaimsDirectory);
    await mkdir(claims, { recursive: true });
    if (mode === "scope-budget")
      spec.file_scope.paths = Array.from(
        { length: AgentHost.MaximumClaims + 1 },
        (_, index) => `src/${index}`,
      );
    if (mode === "invalid-path") spec.file_scope.paths = ["../outside.txt"];
    if (mode === "hard-link") {
      await writeFile(resolve(root, "outside.db"), "");
      await link(resolve(root, "outside.db"), resolve(owner, AgentHost.AdmissionLease));
    }
    if (mode === "unknown-file") await writeFile(resolve(claims, "unknown"), "");
    if (mode === "directory-budget" || mode === "new-claim-budget") {
      const maximum = AgentHost.MaximumClaims + (mode === "directory-budget" ? 1 : 0);
      for (let index = 0; index < maximum; index++)
        await writeFile(resolve(claims, `${index}.db`), "");
    }
    if (mode === "catalogue-corrupt")
      await writeFile(resolve(owner, AgentHost.ScopeCatalogue), "broken database");
    if (mode === "owner-corrupt" || mode === "record-corrupt") {
      const catalogue = new Bun.SQL({
        adapter: "sqlite",
        filename: resolve(owner, AgentHost.ScopeCatalogue),
      });
      try {
        await catalogue.unsafe(AgentHost.CatalogueInitialize);
        const record =
          mode === "record-corrupt"
            ? "{}"
            : JSON.stringify({
                run_id: "old-run",
                execution_id: "old-execution",
                mode: FileAccessMode.Write,
                paths: [resolve(root, "one.txt")],
              });
        await catalogue.unsafe(AgentHost.CatalogueInsert, [0, record]);
      } finally {
        await catalogue.close();
      }
      if (mode === "owner-corrupt") await writeFile(resolve(claims, "0.db"), "broken lease");
    }
    if (mode === "overlapping-input") spec.file_scope.paths = ["src", "src/one.txt"];
    const failure = await thrownBy(() => claimHostFiles(spec, resources));
    if (["regular", "overlapping-input", "new-claim-budget"].includes(mode))
      expect(failure).toBeUndefined();
    else expect(failure).toBeInstanceOf(Error);
    return true;
  });
}

async function claimProcess(spec: AgentSpec, paths: SdkProbePaths): Promise<void> {
  const entry = paths.cli
    ? resolve(dirname(await realpath(paths.cli)), Packaging.AgentBundle)
    : resolve(Packaging.AgentSource);
  await hostedTurn(
    {
      type: AgentHostKind.Start,
      backend: Backend.Codex,
      launch: {
        executable: resolve(paths.vendors ?? Packaging.VendorSources, VendorFixture.Codex),
      },
      spec,
      session_id: null,
      prompt: VendorStubMode.Complete,
    },
    async () => {},
    new AbortController().signal,
    (receive) =>
      Bun.spawn([process.execPath, entry], {
        detached: true,
        env: agentHostEnvironment(ConfigDefault.HostGcMarkers),
        stdin: ProcessIo.Ignore,
        stdout: ProcessIo.Ignore,
        stderr: ProcessIo.Ignore,
        ipc: receive,
        serialization: AgentHost.Serialization,
      }),
  );
}

export async function hostFileLeaseGuard(
  lease: string,
  suffix: string,
  mode: string,
  paths?: SdkProbePaths,
) {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const spec = agentSpec(root);
    spec.file_scope = { mode: FileAccessMode.Write, paths: ["one.txt"] };
    const owner = resolve(root, AgentHost.Directory);
    await mkdir(resolve(owner, AgentHost.ClaimsDirectory), { recursive: true });
    const guarded = resolve(owner, lease + suffix);
    const external = resolve(root, "external.db");
    const bytes = Buffer.from("Preserve unrelated lease target");
    await writeFile(external, bytes, { mode: 0o644 });
    const metadata = await stat(external);
    if (mode === "symbolic") await symlink(external, guarded);
    if (mode === "hard") await link(external, guarded);
    if (mode === "directory") await mkdir(guarded);
    const failure = await thrownBy(() =>
      paths ? claimProcess(spec, paths) : claimHostFiles(spec, resources),
    );
    if (mode === "regular") expect(failure).toBeUndefined();
    else expect(failure).toMatchObject({ code: ErrorCode.ExecutionInterrupted });
    expect(await readFile(external)).toEqual(bytes);
    expect((await stat(external)).mode).toBe(metadata.mode);
    return true;
  });
}

export function hostFileLeaseProcess(
  lease: string,
  suffix: string,
  mode: string,
  paths: SdkProbePaths = {},
) {
  return hostFileLeaseGuard(lease, suffix, mode, paths);
}
