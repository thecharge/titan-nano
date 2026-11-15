import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HandChange,
  HandChangeFixture,
  HandChangeTest,
  HookCommand,
  HookFile,
} from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { runHandChangeCheck, runMessagePolicy } from "../../tooling/scripts/hand-changes.ts";
import { commandOutput } from "../../tooling/scripts/hook-process.ts";
import { hookPolicyFixture } from "../cases/hook-policy.ts";
import { prepareTools } from "./hooks.ts";

const bothFiles = [HandChangeTest.FileA, HandChangeTest.FileB];
const noFiles: string[] = [];
const oneFile = [HandChangeTest.FileA];
const policyFixtures = new Set([
  HandChangeFixture.PolicyListed,
  HandChangeFixture.PolicyUnlisted,
  HandChangeFixture.PolicyInvalid,
]);

function stagedFor(fixture: HandChangeFixture): string[] {
  if (
    fixture === HandChangeFixture.NothingStaged ||
    fixture === HandChangeFixture.MissingMessage ||
    fixture === HandChangeFixture.NotRepository
  )
    return noFiles;
  if (
    fixture === HandChangeFixture.Listed ||
    fixture === HandChangeFixture.Mixed ||
    fixture === HandChangeFixture.MixedListed
  )
    return bothFiles;
  return oneFile;
}

function listing(files: readonly string[]): string {
  return `${HandChangeTest.Subject}${HandChangeTest.Body}${HandChange.Prefix}${files.join(HandChange.Separator)}`;
}

function messageFor(fixture: HandChangeFixture): string {
  if (fixture === HandChangeFixture.Wrapped)
    return listing(oneFile).replace(HandChange.Prefix, `${HandChange.Prefix.trimEnd()}\n `);
  if (fixture === HandChangeFixture.WrappedWindows)
    return listing(oneFile).replace(HandChange.Prefix, `${HandChange.Prefix.trimEnd()}\r\n\t`);
  if (fixture === HandChangeFixture.Unindented)
    return listing(oneFile).replace(HandChange.Prefix, `${HandChange.Prefix.trimEnd()}\n`);
  if (fixture === HandChangeFixture.EmptyWrapped) return `${listing([]).trimEnd()}\n `;
  if (fixture === HandChangeFixture.Listed) return listing(bothFiles);
  if (fixture === HandChangeFixture.MixedListed) return listing([HandChangeTest.FileB]);
  if (fixture === HandChangeFixture.PolicyListed) return listing(oneFile);
  if (fixture === HandChangeFixture.PolicyInvalid) return HandChangeTest.Invalid;
  return HandChangeTest.Subject;
}

function recordFor(fixture: HandChangeFixture): string | null {
  if (fixture === HandChangeFixture.CorruptRecord) return HandChangeTest.Corrupt;
  if (
    fixture === HandChangeFixture.WrittenByRun ||
    fixture === HandChangeFixture.Mixed ||
    fixture === HandChangeFixture.MixedListed
  )
    return JSON.stringify([HandChangeTest.FileA]);
  return null;
}

export async function handChanges(fixture: HandChangeFixture): Promise<number> {
  return withTemporaryDirectory(async (root) => {
    if (fixture !== HandChangeFixture.NotRepository)
      await commandOutput([HookCommand.Git, HandChangeTest.Init, HandChangeTest.Initial], {
        cwd: root,
      });
    for (const file of bothFiles) await writeFile(join(root, file), HandChangeTest.Content);
    const staged = stagedFor(fixture);
    if (staged.length > 0)
      await commandOutput([HookCommand.Git, HandChangeTest.Add, ...staged], { cwd: root });
    const record = recordFor(fixture);
    if (record !== null) {
      await mkdir(join(root, HandChangeTest.Folder), { recursive: true });
      await writeFile(join(root, HandChange.RunRecord), record);
    }
    const message = join(root, HandChangeTest.Message);
    await writeFile(message, messageFor(fixture));
    const target = fixture === HandChangeFixture.MissingMessage ? undefined : message;
    if (!policyFixtures.has(fixture)) return runHandChangeCheck(root, target);
    await prepareTools(root);
    await writeFile(join(root, HookFile.Configuration), Bun.YAML.stringify(hookPolicyFixture));
    return runMessagePolicy(root, target);
  });
}
