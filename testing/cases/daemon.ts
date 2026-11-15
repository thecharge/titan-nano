import {
  DaemonClientFixture,
  DaemonEntryFixture,
  DaemonFixture,
  DaemonProbeFixture,
  EmbeddedRuntimeBuild,
  ErrorCode,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const daemonStartupCases = {
  positive: [
    positive("start a detached authenticated local daemon", [DaemonFixture.Fresh], true),
    positive(
      "reuse the existing owner without spawning another daemon",
      [DaemonFixture.Reuse],
      true,
    ),
    positive(
      "simultaneous clients converge on the same leased owner",
      [DaemonFixture.Concurrent],
      true,
    ),
    positive(
      "replace malformed discovery under an available owner lease",
      [DaemonFixture.Stale],
      true,
    ),
  ],
  negative: [
    rejected("zero startup deadline fails before launch", [DaemonFixture.Zero], true),
    rejected("excess startup deadline fails before launch", [DaemonFixture.Excess], true),
    rejected("failed process launch returns a transport error", [DaemonFixture.LaunchError], true),
    rejected("expired initial probe cannot launch a daemon", [DaemonFixture.ExpiredProbe], true),
    rejected("early child exit cannot report readiness", [DaemonFixture.Exited], true),
    rejected("deadline failure kills and reaps its owned child", [DaemonFixture.Timeout], true),
  ],
};

export const daemonProbeCases = {
  positive: [
    positive(
      "an embedded server explicitly retains version compatibility",
      [DaemonProbeFixture.Healthy, "build-a", EmbeddedRuntimeBuild],
      true,
    ),
    positive(
      "embedded compatibility preserves a valid trailing health frame",
      [DaemonProbeFixture.Trailing, "build-a", EmbeddedRuntimeBuild],
      true,
    ),
    positive(
      "the exact installed build can reuse its daemon",
      [DaemonProbeFixture.Healthy, "build-a", "build-a"],
      true,
    ),
    positive(
      "maintenance inspection can discover another build",
      [DaemonProbeFixture.Healthy, "build-a", "build-b", true],
      true,
    ),
    positive("authenticated health returns ready", [DaemonProbeFixture.Healthy], true),
    positive(
      "trailing discovery slash preserves the health route",
      [DaemonProbeFixture.Trailing],
      true,
    ),
  ],
  negative: [
    rejected(
      "the same release version with different bytes cannot be reused",
      [DaemonProbeFixture.Healthy, "build-a", "build-b"],
      true,
    ),
    rejected(
      "a legacy daemon without build identity cannot be reused by a packaged client",
      [DaemonProbeFixture.Healthy, "build-a"],
      true,
    ),
    rejected(
      "older daemon cannot silently serve the current command",
      [DaemonProbeFixture.Older],
      true,
    ),
    rejected(
      "newer daemon cannot silently serve an earlier command",
      [DaemonProbeFixture.Newer],
      true,
    ),
    rejected(
      "unauthorized health cannot establish readiness",
      [DaemonProbeFixture.Unauthorized],
      true,
    ),
    rejected("empty response cannot establish readiness", [DaemonProbeFixture.Empty], true),
    rejected("malformed JSON cannot establish readiness", [DaemonProbeFixture.Malformed], true),
    rejected("oversized health is bounded and refused", [DaemonProbeFixture.Oversized], true),
    rejected(
      "invalid health schema cannot establish readiness",
      [DaemonProbeFixture.Invalid],
      true,
    ),
    rejected("absent discovery cannot establish readiness", [DaemonProbeFixture.Missing], true),
  ],
};

export const daemonEntryCases = {
  positive: [
    positive(
      "source launch resolves the owned CLI entry",
      [DaemonEntryFixture.Source, false],
      true,
    ),
    positive(
      "installed launch resolves the packaged bundle",
      [DaemonEntryFixture.Bundle, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "traversal-shaped source cannot redirect the launch",
      [DaemonEntryFixture.Traversal, false],
      true,
    ),
    rejected(
      "empty source hint remains bound to the owned bundle",
      [DaemonEntryFixture.Empty, true],
      true,
    ),
  ],
};

export const daemonClientsCases = {
  positive: [
    positive("run client starts and queries its owner", [DaemonClientFixture.Runs, false], true),
    positive(
      "knowledge client starts and uses its owner",
      [DaemonClientFixture.Knowledge, false],
      true,
    ),
    positive(
      "request client starts and lists its owner requests",
      [DaemonClientFixture.Requests, false],
      true,
    ),
    positive(
      "CLI MCP starts its owner before stdio attachment",
      [DaemonClientFixture.Mcp, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "empty knowledge id cannot create a daemon",
      [DaemonClientFixture.EmptyKnowledge, true],
      true,
    ),
    rejected(
      "unsafe knowledge id cannot create a daemon",
      [DaemonClientFixture.UnsafeKnowledge, true],
      true,
    ),
    rejected(
      "unsafe request run cannot create a daemon",
      [DaemonClientFixture.UnsafeRun, true],
      true,
    ),
    rejected(
      "unsafe request id cannot create a daemon",
      [DaemonClientFixture.UnsafeRequest, true],
      true,
    ),
  ],
};

export const runtimeBuildIdentityCases = {
  positive: [
    positive("bundled runtime identity hashes its exact bytes", ["bundle"], true),
    positive("source execution retains its development discovery contract", ["source"], true),
  ],
  negative: [
    negative("a missing bundle cannot advertise a build", ["missing"], { code: "ENOENT" }),
    negative("an oversized bundle cannot escape the identity budget", ["oversized"], {
      code: ErrorCode.StreamLimit,
    }),
  ],
};
