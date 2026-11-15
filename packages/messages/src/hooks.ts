import { HandChange } from "@titan/constants";

export const HookMessage = {
  HandChanges: "Commit holds changes no run wrote; add this line to the commit message",
  InvalidMode: "Use commit or push for the hook mode",
  InvalidPolicy:
    "Hook or secret policy is missing, weakened or inconsistent with the checked commands",
  OutputLimit: "Hook command exceeded its bounded output limit",
  ProcessFailed: "Hook command failed",
  MissingDependencies:
    "Hook dependencies are missing or changed. Run bun install --frozen-lockfile, then retry.",
  WrongRuntime: "Hooks require the pinned Bun version from package.json",
  InvalidPush: "Git supplied an invalid push update",
  TooManyCommits: "Push exceeds the bounded commit inventory; split the push before retrying",
  MissingRemote:
    "The advertised remote commit is unavailable locally. Fetch the remote, then retry.",
  UnsafeSnapshot: "Hook snapshots do not accept tracked symbolic links or submodules",
  Snapshot: "Checking Git snapshot",
  AlreadyVerified: "This exact tree already passed every check; checks are skipped",
  FullScope: "Full scope: all checks run",
  DocumentationScope: "Documentation scope: all non-test checks run",
  Incomplete: "Hook checks failed; no readiness claim or check receipt was created",
} as const;

export const OfflineMessage = {
  Selection:
    "Offline test selection is missing, outside the named tiers, symbolic or exceeds its bounded inventory",
  Unsupported: "Offline tests require Linux and rootless Podman. See docs/preview.md.",
  Prepare:
    "Prepare the offline image first: bun run test:prepare (see docs/preview.md for the pinned base image).",
  Failed: "Offline boundary or tests failed. No unsandboxed fallback ran.",
} as const;

export const hookCommandFailed = (command: readonly string[], code: number): string =>
  `${HookMessage.ProcessFailed}: ${command.join(" ")} (exit ${code})`;

export const hookCheckResult = (
  command: readonly string[],
  code: number,
  elapsed: number,
): string => `${command.join(" ")}: exit ${code}, ${elapsed.toFixed(0)} ms`;

export const handChangesMissing = (files: readonly string[]): string =>
  `${HandChange.Prefix}${files.join(HandChange.Separator)}`;

export const commitSubjectFailed = (subject: string): string => `FAIL ${subject}`;
