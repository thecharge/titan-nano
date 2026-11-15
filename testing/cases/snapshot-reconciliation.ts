import { SnapshotMutation } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const snapshotReconciliationCases = {
  positive: [
    positive("stable WAL inventory completes without recovery", [SnapshotMutation.None, 1], true),
    positive("stable WAL capture completes without recovery", [SnapshotMutation.None, 2], true),
  ],
  negative: [
    rejected(
      "removed WAL during inventory retains received work",
      [SnapshotMutation.Deleted, 1],
      true,
    ),
    rejected(
      "removed WAL during capture retains received work",
      [SnapshotMutation.Deleted, 2],
      true,
    ),
    rejected(
      "removed WAL during verification retains received work",
      [SnapshotMutation.Deleted, 3],
      true,
    ),
    rejected(
      "removed WAL during final inventory retains received work",
      [SnapshotMutation.Deleted, 4],
      true,
    ),
    rejected(
      "WAL append during capture is reconciled after restart",
      [SnapshotMutation.Changed, 2],
      true,
    ),
    rejected(
      "WAL append during verification is reconciled after restart",
      [SnapshotMutation.Changed, 3],
      true,
    ),
    rejected(
      "WAL append during final inventory is reconciled after restart",
      [SnapshotMutation.Changed, 4],
      true,
    ),
  ],
};
