import { strict as assert } from "node:assert";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ErrorCode,
  FileEncoding,
  LeanCaseFile,
  LeanCheck,
  LeanCheckFixture,
  LeanLimitMode,
} from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { CommandCaptureMessage } from "@titan/messages";
import { leanRunner } from "@titan/process";
import { leanCheck } from "@titan/runner";
import type { CapturedCommandProcess, CommandProcessPort, LeanRun } from "@titan/types";

function source(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), FileEncoding.Utf8);
}

function caseSource(file: LeanCaseFile): Promise<string> {
  return source(`${LeanCheckFixture.Cases}${file}${LeanCheckFixture.Extension}`);
}

function joined(command: readonly string[]): string {
  return command.join(LeanCheck.CommandSeparator);
}

function capture(code: number, lines: readonly string[]) {
  return {
    exit_code: code,
    stdout: Buffer.from(lines.join(LeanCheck.EvidenceSeparator)),
    stderr: Buffer.alloc(0),
  };
}

function stream(hold: boolean, data: Uint8Array, releases: Array<() => void>) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!hold) {
        controller.enqueue(data);
        controller.close();
        return;
      }
      releases.push(() => {
        try {
          controller.close();
        } catch {
          return;
        }
      });
    },
  });
}

function fakePort(hold: boolean, spawned: string[][]): CommandProcessPort {
  const releases: Array<() => void> = [];
  return {
    spawn(command): CapturedCommandProcess {
      spawned.push([...command]);
      const exited = hold
        ? new Promise<number>((resolve) => {
            releases.push(() => resolve(LeanCheckFixture.KilledCode));
          })
        : Promise.resolve(0);
      return {
        pid: LeanCheckFixture.Pid,
        stdout: stream(hold, new TextEncoder().encode(LeanCheck.Okay), releases),
        stderr: stream(hold, new Uint8Array(), releases),
        exited,
        signalCode: hold ? LeanCheckFixture.KilledSignal : null,
        kill: () => undefined,
      };
    },
    stop() {
      for (const release of releases.splice(0)) release();
    },
  };
}

async function withParent<T>(body: (parent: string) => Promise<T>): Promise<T> {
  const parent = await mkdtemp(join(tmpdir(), LeanCheckFixture.Parent));
  try {
    return await body(parent);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

export async function leanAnswer(
  file: LeanCaseFile,
  paranoid: boolean,
): Promise<readonly [string, string | undefined, string | undefined]> {
  const statement = await source(LeanCheckFixture.ChallengeSource);
  const everyCase = Object.values(LeanCaseFile);
  const texts = await all(everyCase.map((name) => () => caseSource(name)));
  const commands: string[][] = [];
  const run: LeanRun = async (command, cwd) => {
    commands.push([...command]);
    if (joined(command) === joined(LeanCheck.Setup)) return capture(0, LeanCheckFixture.SetupLines);
    const written = await readFile(join(cwd, LeanCheck.SolutionFile), FileEncoding.Utf8);
    const found = everyCase.find((_, at) => texts[at] === written);
    if (found === undefined)
      return capture(LeanCheckFixture.Unreadable, [LeanCheckFixture.Missing]);
    const evidence = LeanCheckFixture.Evidence[found];
    return capture(evidence.code, evidence.lines);
  };
  const checked = await withParent(async (parent) =>
    leanCheck(
      run,
      {
        parent,
        statement,
        solution: texts[everyCase.indexOf(file)] ?? LeanCheckFixture.Empty,
        theorems: [LeanCheckFixture.Theorem, LeanCheckFixture.SecondTheorem],
        paranoid,
      },
      new AbortController().signal,
    ),
  );
  const last = checked.evidence.split(LeanCheck.EvidenceSeparator).at(-1);
  const final = commands.at(-1);
  return [checked.answer, last, final === undefined ? undefined : joined(final)];
}

export async function leanFolder(
  theorems: readonly string[],
): Promise<readonly [string, string, boolean] | string> {
  const statement = await source(LeanCheckFixture.ChallengeSource);
  const solution = await caseSource(LeanCaseFile.Good);
  let seenToolchain: string = LeanCheckFixture.Empty;
  let seenTheorems: string = LeanCheckFixture.Empty;
  let folder: string = LeanCheckFixture.Empty;
  const run: LeanRun = async (command, cwd) => {
    if (joined(command) === joined(LeanCheck.Setup)) return capture(0, LeanCheckFixture.SetupLines);
    folder = cwd;
    const read = (name: string) => readFile(join(cwd, name), FileEncoding.Utf8);
    assert.equal(await read(LeanCheck.LakefileName), LeanCheck.Lakefile);
    assert.equal(await read(LeanCheck.ChallengeFile), statement);
    assert.equal(await read(LeanCheck.SolutionFile), solution);
    const manifest = JSON.parse(await read(LeanCheck.ComparatorFile));
    assert.equal(manifest.challenge_module, LeanCheck.ChallengeModule);
    assert.equal(manifest.solution_module, LeanCheck.SolutionModule);
    assert.deepEqual(manifest.permitted_axioms, [...LeanCheck.Axioms]);
    seenToolchain = await read(LeanCheck.ToolchainFile);
    seenTheorems = manifest.theorem_names.join(LeanCheck.EvidenceSeparator);
    return capture(0, [LeanCheck.Okay]);
  };
  try {
    await withParent(async (parent) =>
      leanCheck(
        run,
        { parent, statement, solution, theorems: [...theorems] },
        new AbortController().signal,
      ),
    );
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    return LeanCheckFixture.Rejected;
  }
  const removed = await access(folder).then(
    () => false,
    () => true,
  );
  return [seenToolchain, seenTheorems, removed];
}

export async function leanLimit(
  mode: LeanLimitMode,
  seconds: number,
): Promise<readonly [string, string, number]> {
  const statement = await source(LeanCheckFixture.ChallengeSource);
  const solution = await caseSource(LeanCaseFile.Good);
  const spawned: string[][] = [];
  const controller = new AbortController();
  if (mode === LeanLimitMode.Aborted) controller.abort();
  const run: LeanRun =
    mode === LeanLimitMode.Thrown
      ? async () => {
          throw new OperationalError(ErrorCode.CommandTimeout, CommandCaptureMessage.Timeout);
        }
      : leanRunner(fakePort(mode === LeanLimitMode.Hanging, spawned));
  const input = {
    statement,
    solution,
    theorems: [LeanCheckFixture.Theorem],
    timeout_s: seconds,
  };
  let checked: Awaited<ReturnType<typeof leanCheck>>;
  try {
    checked = await withParent(async (parent) =>
      leanCheck(run, { ...input, parent }, controller.signal),
    );
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.equal(mode, LeanLimitMode.Aborted);
    return [LeanCheckFixture.Rethrown, LeanCheckFixture.Empty, spawned.length];
  }
  for (const command of spawned)
    assert.deepEqual(command.slice(0, LeanCheck.Sandbox.length), [...LeanCheck.Sandbox]);
  return [checked.answer, checked.evidence, spawned.length];
}
