import { SnapshotMutation } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeSharedReadsCases = {
  positive: [
    positive(
      "production peers retain completed work while dependency claims yield",
      [false, false],
      true,
    ),
    positive(
      "production peers negotiate a dependency below a parent write scope",
      [true, false],
      true,
    ),
  ],
  negative: [
    rejected("cancelling a revised claim preserves the running peer", [false, true], true),
    rejected("cancelling a nested dependency wait preserves peer completion", [true, true], true),
  ],
};

export const nativeServerFilesCases = {
  positive: [
    positive(
      "completed worker reconciles a changed checker dependency",
      [false, true, false, true, 1],
      true,
    ),
    positive(
      "completed worker reconciles a selected nested dependency",
      [false, true, true, true, 1],
      true,
    ),
    positive("production server retains worker reads and listings", [true, false], true),
    positive("production server retains checker reads and listings", [false, false], true),
    positive("worker managed reads ignore an unrelated unsafe subtree", [true, false, true], true),
    positive(
      "checker managed reads ignore an unrelated unsafe subtree",
      [false, false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "spent allowance retains the completed worker and its changed dependency",
      [false, true, false, true, 0],
      true,
    ),
    rejected(
      "spent allowance cannot repeat a completed nested worker",
      [false, true, true, true, 0],
      true,
    ),
    rejected("production server blocks a changed worker dependency", [true, true], true),
    rejected("production server blocks a changed checker dependency", [false, true], true),
    rejected("narrow worker reads still reject their changed dependency", [true, true, true], true),
    rejected(
      "narrow checker reads still reject their changed dependency",
      [false, true, true],
      true,
    ),
  ],
};

export const nativeFileIsolatedCases = {
  positive: [
    positive(
      "legacy isolated worker reads its execution tree",
      [true, SnapshotMutation.None],
      true,
    ),
    positive("legacy isolated checker reads its review tree", [false, SnapshotMutation.None], true),
  ],
  negative: [
    rejected(
      "changed isolated worker dependency invalidates its read",
      [true, SnapshotMutation.Changed],
      true,
    ),
    rejected(
      "deleted isolated checker dependency invalidates its read",
      [false, SnapshotMutation.Deleted],
      true,
    ),
  ],
};

export const nativeFileListingCases = {
  positive: [
    positive(
      "worker retains file names before acknowledgement",
      [true, SnapshotMutation.None],
      true,
    ),
    positive(
      "checker retains file names before acknowledgement",
      [false, SnapshotMutation.None],
      true,
    ),
  ],
  negative: [
    rejected(
      "new dependency outside writes invalidates worker file listing",
      [true, SnapshotMutation.Changed],
      true,
    ),
    rejected(
      "removed dependency invalidates checker file listing",
      [false, SnapshotMutation.Deleted],
      true,
    ),
  ],
};

export const nativeFileObservationCases = {
  positive: [
    positive(
      "worker retains a missing-file observation",
      [true, SnapshotMutation.None, false, false],
      true,
    ),
    positive(
      "checker retains a missing-file observation",
      [false, SnapshotMutation.None, false, false],
      true,
    ),
    positive(
      "worker read is durable before acknowledgement and survives restart",
      [true, SnapshotMutation.None],
      true,
    ),
    positive(
      "checker read is durable before acknowledgement and survives restart",
      [false, SnapshotMutation.None],
      true,
    ),
  ],
  negative: [
    rejected(
      "creating a missing worker dependency invalidates its read",
      [true, SnapshotMutation.Changed, false, false],
      true,
    ),
    rejected(
      "creating a missing checker dependency invalidates its read",
      [false, SnapshotMutation.Changed, false, false],
      true,
    ),
    rejected(
      "changed dependency outside writes blocks the received worker",
      [true, SnapshotMutation.Changed],
      true,
    ),
    rejected(
      "deleted dependency blocks checker acceptance",
      [false, SnapshotMutation.Deleted],
      true,
    ),
    rejected(
      "permission change invalidates an observed dependency",
      [true, SnapshotMutation.Metadata],
      true,
    ),
    rejected(
      "replacement with identical bytes invalidates an observed dependency",
      [false, SnapshotMutation.Grown],
      true,
    ),
    rejected(
      "failed worker read audit cannot acknowledge or publish",
      [true, SnapshotMutation.None, true],
      true,
    ),
    rejected(
      "failed checker read audit cannot acknowledge or publish",
      [false, SnapshotMutation.None, true],
      true,
    ),
  ],
};
