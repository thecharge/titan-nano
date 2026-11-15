import { FlatTestRule, TestLayout } from "./test-structure.ts";

export const OfflineTest = {
  Platform: "linux",
  Runtime: "podman",
  Containerfile: "testing/container/Containerfile",
  BuildContext: "testing/container",
  ImagePrefix: "localhost/titan/offline-tests:",
  ImageDigestLength: 20,
  DependencyCache: "node_modules/.bun",
  Coverage: "coverage",
  Workspace: "/workspace",
  BoundaryEnvironment: "--env=TITAN_TEST_BOUNDARY=podman",
  Driver: "tooling/scripts/inside-offline.ts",
  Shards: 8,
  FastVariable: "TITAN_TEST_FAST",
  FastValue: "1",
  FastOption: "--env=TITAN_TEST_FAST=1",
  ShardCoverage: "coverage/shard-",
  CoverageDirectoryOption: "--coverage-dir=",
  LcovFile: "lcov.info",
} as const;

export const OfflineRunArguments = [
  "run",
  "--rm",
  "--init",
  "--pull=never",
  "--network=none",
  "--http-proxy=false",
  "--read-only",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges",
  "--pids-limit=4096",
  "--memory=24g",
  "--cpus=14",
  "--tmpfs=/tmp:rw,exec,nosuid,nodev,size=8g,mode=1777",
] as const;

export const OfflineTestRoots = TestLayout.TierDirectories.map((directory) => `./${directory}`);

export const PodmanArgument = {
  ImageExists: ["image", "exists"],
  Build: ["build", "--pull=never", "--file"],
  Tag: "--tag",
  Volume: "--volume",
  WorkDirectory: "--workdir=",
  ReadOnly: ":ro",
  ReadWrite: ":rw",
} as const;

export const OfflineSelectionLimit = {
  Arguments: 256,
  PathCharacters: 4096,
  Files: FlatTestRule.MaximumFiles,
  Entries: 4096,
  Pattern: "testing/**/*",
} as const;
