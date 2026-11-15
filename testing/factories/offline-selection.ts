import { strict as assert } from "node:assert";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ExitCode,
  IoLimit,
  OfflineSelectorFixture,
  OfflineSelectorFixtureMode,
  OfflineTest,
  TestLayout,
} from "@titan/constants";
import { OfflineMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { OfflineSelectionLimitsInput } from "@titan/types";
import { exists } from "@titan/workspace";
import { selectOfflineTests } from "../../tooling/scripts/offline-selection.ts";
import { captureCli } from "../support/command.ts";

async function selectionFixture(root: string, mode: OfflineSelectorFixtureMode) {
  for (const tier of TestLayout.TierDirectories)
    await mkdir(resolve(root, tier), { recursive: true });
  if (mode === OfflineSelectorFixtureMode.Empty) return;
  const marker = resolve(root, OfflineSelectorFixture.Marker);
  const program = OfflineSelectorFixture.Program.replace(
    OfflineSelectorFixture.Token,
    JSON.stringify(marker),
  );
  for (const path of [
    OfflineSelectorFixture.First,
    OfflineSelectorFixture.Second,
    OfflineSelectorFixture.Integration,
    OfflineSelectorFixture.EndToEnd,
    OfflineSelectorFixture.Outside,
    OfflineSelectorFixture.NonTest,
  ]) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), Buffer.from(program));
  }
  if (mode === OfflineSelectorFixtureMode.DirectoryLink)
    return symlink(
      resolve(root, TestLayout.TierDirectories[1]),
      resolve(root, TestLayout.TierDirectories[0], OfflineSelectorFixture.Marker),
    );
  if (mode === OfflineSelectorFixtureMode.DanglingLink)
    return symlink(
      resolve(root, OfflineSelectorFixture.Missing),
      resolve(root, OfflineSelectorFixture.Linked),
    );
  if (
    [OfflineSelectorFixtureMode.ExternalLink, OfflineSelectorFixtureMode.InternalLink].includes(
      mode,
    )
  ) {
    const target =
      mode === OfflineSelectorFixtureMode.ExternalLink
        ? OfflineSelectorFixture.Outside
        : OfflineSelectorFixture.First;
    await symlink(resolve(root, target), resolve(root, OfflineSelectorFixture.Linked));
  }
}

export async function offlineSelection(
  mode: OfflineSelectorFixtureMode,
  selected: unknown,
  limits: OfflineSelectionLimitsInput = {},
) {
  return withTemporaryDirectory(async (root) => {
    await selectionFixture(root, mode);
    return selectOfflineTests(root, selected, limits);
  });
}

export async function offlineSelectionProcess(selected: string[], launched: boolean) {
  const driver = resolve(OfflineTest.Driver);
  return withTemporaryDirectory(async (root) => {
    await selectionFixture(root, OfflineSelectorFixtureMode.Normal);
    const result = await captureCli(driver, selected, root, {
      ...process.env,
      [OfflineTest.FastVariable]: undefined,
    });
    assert.equal(result.code, ExitCode.Unsuccessful);
    assert.equal(result.error.toString().includes(OfflineMessage.Selection), !launched);
    const marker = resolve(root, OfflineSelectorFixture.Marker);
    assert.equal(await exists(marker), launched);
    if (launched)
      assert.equal(
        (await readFileBytes(marker, IoLimit.DataBytes)).toString(),
        OfflineSelectorFixture.Content,
      );
    return true;
  });
}

export async function offlineDriverOutput(stderr: boolean, failure: boolean) {
  const driver = resolve(OfflineTest.Driver);
  return withTemporaryDirectory(async (root) => {
    await selectionFixture(root, OfflineSelectorFixtureMode.Normal);
    const payload =
      OfflineSelectorFixture.OutputStart +
      OfflineSelectorFixture.OutputFill.repeat(OfflineSelectorFixture.OutputBytes) +
      OfflineSelectorFixture.OutputEnd;
    const program = OfflineSelectorFixture.OutputProgram.replace(
      "__STREAM__",
      stderr ? "Bun.stderr" : "Bun.stdout",
    )
      .replace("__PAYLOAD__", JSON.stringify(payload))
      .replace("__FAIL__", String(failure));
    await writeFile(resolve(root, OfflineSelectorFixture.First), Buffer.from(program));
    const result = await captureCli(driver, [OfflineSelectorFixture.First], root, {
      ...process.env,
      [OfflineTest.FastVariable]: undefined,
    });
    assert.equal(result.code, ExitCode.Unsuccessful);
    const output = (stderr ? result.error : result.output).toString();
    assert.equal(output.includes(payload), true);
    assert.equal(result.error.toString().includes(failure ? "1 fail" : "1 pass"), true);
    return true;
  });
}
