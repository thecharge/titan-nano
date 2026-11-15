import { NativeEventFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeEventProjectionCases = {
  positive: [
    positive(
      "Codex start retains intent metadata",
      [NativeEventFixture.CodexStarted, true, true, false],
      true,
    ),
    positive(
      "Codex update retains progress metadata",
      [NativeEventFixture.CodexUpdated, true, true, false],
      true,
    ),
    positive(
      "unknown native name becomes safe marker",
      [NativeEventFixture.UnknownTool, true, true, false],
      true,
    ),
    positive(
      "ordinary Claude text remains available",
      [NativeEventFixture.ClaudeText, true, false, false],
      true,
    ),
    positive(
      "unrelated Claude use remains available",
      [NativeEventFixture.ClaudeExternal, true, false, false],
      true,
    ),
    positive(
      "event without vendor marker remains available",
      [NativeEventFixture.Unmarked, true, false, false],
      true,
    ),
    positive(
      "Codex result retains bounded metadata",
      [NativeEventFixture.Codex, true, true, false],
      true,
    ),
    positive(
      "Claude native use removes arguments",
      [NativeEventFixture.ClaudeUse, true, true, false],
      true,
    ),
    positive(
      "Claude result removes entry body",
      [NativeEventFixture.ClaudeResult, true, true, false],
      true,
    ),
    positive(
      "Claude structured result removes entry body",
      [NativeEventFixture.ClaudeStructured, true, true, false],
      true,
    ),
    positive(
      "Claude partial removes incremental body",
      [NativeEventFixture.ClaudePartial, true, true, false],
      true,
    ),
    positive(
      "ordinary event retains existing behavior",
      [NativeEventFixture.Ordinary, true, false, false],
      true,
    ),
    positive(
      "unrelated Codex server retains existing behavior",
      [NativeEventFixture.External, true, false, false],
      true,
    ),
    positive(
      "disabled native tools retain existing behavior",
      [NativeEventFixture.Codex, false, false, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "missing Claude identity refuses projection",
      [NativeEventFixture.ClaudeMissingIdentity, true, false, true],
      true,
    ),
    rejected(
      "invalid Claude block refuses projection",
      [NativeEventFixture.ClaudeBadBlock, true, false, true],
      true,
    ),
    rejected(
      "missing call identity refuses projection",
      [NativeEventFixture.MissingIdentity, true, false, true],
      true,
    ),
    rejected(
      "unsupported status refuses projection",
      [NativeEventFixture.UnsupportedStatus, true, false, true],
      true,
    ),
    rejected(
      "excessive Claude blocks refuse projection",
      [NativeEventFixture.ExcessBlocks, true, false, true],
      true,
    ),
  ],
};
