import { positive, rejected } from "@titan/test-factories";

export const nativeShellSdkCases = {
  positive: [
    positive(
      "pinned SDK carries wrapped input through both shell permission callbacks",
      ["printf allowed", false],
      true,
    ),
    positive(
      "pinned SDK preserves a quoted shell command through control responses",
      ["printf 'quoted value'", false],
      true,
    ),
  ],
  negative: [
    rejected("pinned SDK retains protected-path refusal", ["cat .git/config", true], true),
    rejected("pinned SDK retains outside-path refusal", ["cat /etc/passwd", true], true),
  ],
};

export const nativeShellBoundaryCases = {
  positive: [
    positive(
      "scoped shell wraps an allowed exact-file update",
      ["bun -e \"require('fs').writeFileSync('allowed.txt','Changed')\"", ["allowed.txt"]],
      true,
    ),
    positive(
      "scoped shell preserves quoted command arguments",
      ["printf 'a quoted value'", ["allowed.txt"]],
      true,
    ),
    positive(
      "scoped shell registry stays bounded",
      ["printf initial", ["allowed.txt"], false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "failed shell scope initialization closes without execution",
      ["printf initial", ["linked.txt"], false, "initialization"],
      true,
    ),
    rejected(
      "scoped shell refuses an oversized command",
      ["printf initial", ["allowed.txt"], false, "command"],
      true,
    ),
    rejected(
      "scoped shell refuses an excessive command registry byte budget",
      ["printf initial", ["allowed.txt"], false, "registry"],
      true,
    ),
    rejected(
      "arbitrary programs cannot write an unlisted file",
      ["bun -e \"require('fs').writeFileSync('outside.txt','UNSANDBOXED')\"", ["allowed.txt"]],
      true,
    ),
    rejected(
      "root scope keeps protected metadata read-only",
      ["bun -e \"require('fs').writeFileSync(['.','git/config'].join(''),'UNSANDBOXED')\"", ["."]],
      true,
    ),
    rejected(
      "metadata paths are refused before shell dispatch",
      ["cat .git/config", ["allowed.txt"], true],
      true,
    ),
    rejected(
      "absolute outside shell paths are refused",
      ["cat /etc/passwd", ["allowed.txt"], true],
      true,
    ),
  ],
};
