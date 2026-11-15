import { SnapshotMutation } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const retained = { refused: false, liveDatabasePreserved: true };
const refused = { refused: true, liveDatabasePreserved: true };

export const treeStabilityCases = {
  positive: [
    positive(
      "a stable SQLite database and companions are captured",
      [SnapshotMutation.None, false],
      retained,
    ),
    positive(
      "a concurrent read without WAL companions remains stable",
      [SnapshotMutation.None, true],
      retained,
    ),
    positive(
      "selected SQLite companions retain their coherent stable bundle",
      [SnapshotMutation.None, false, true],
      retained,
    ),
    positive(
      "selected non-WAL database remains readable",
      [SnapshotMutation.None, true, true],
      retained,
    ),
  ],
  negative: [
    rejected(
      "a WAL read cannot hide changed shared-memory bytes",
      [SnapshotMutation.Escape],
      refused,
    ),
    rejected("a concurrent WAL append invalidates the bundle", [SnapshotMutation.Changed], refused),
    rejected(
      "a checkpoint cannot mix old and new companions",
      [SnapshotMutation.Metadata],
      refused,
    ),
    rejected("new WAL companions cannot be omitted", [SnapshotMutation.Grown], refused),
    rejected(
      "removed companions cannot become a partial bundle",
      [SnapshotMutation.Deleted],
      refused,
    ),
    rejected(
      "selected WAL reads still detect changed shared memory",
      [SnapshotMutation.Escape, false, true],
      refused,
    ),
    rejected(
      "selected WAL append invalidates the retained bundle",
      [SnapshotMutation.Changed, false, true],
      refused,
    ),
    rejected(
      "selected checkpoint cannot mix companion versions",
      [SnapshotMutation.Metadata, false, true],
      refused,
    ),
    rejected(
      "selected absent companions are retained as membership dependencies",
      [SnapshotMutation.Grown, false, true],
      refused,
    ),
    rejected(
      "selected disappearing companions cannot become a partial bundle",
      [SnapshotMutation.Deleted, false, true],
      refused,
    ),
  ],
};

export const runtimeOmissionsCases = {
  positive: [
    positive("owned root database changes do not enter project evidence", ["same"], true),
    positive("nested runtime omissions retain neighboring project files", ["nested"], true),
  ],
  negative: [
    rejected("an unowned database still needs a stable snapshot", ["unowned"], true),
    rejected("runtime path prefixes cannot hide another database", ["prefix"], true),
    rejected("an omission cannot escape the project", ["escape"], true),
  ],
};

export const inventoryStabilityCases = {
  positive: [
    positive("stable WAL inventory preserves records", ["state.db-wal", 0], true),
    positive("stable shared-memory inventory preserves records", ["state.db-shm", 0], true),
  ],
  negative: [
    rejected(
      "WAL removal during initial inventory is a snapshot conflict",
      ["state.db-wal", 1],
      true,
    ),
    rejected(
      "shared-memory removal during initial inventory is a snapshot conflict",
      ["state.db-shm", 1],
      true,
    ),
    rejected(
      "WAL removal during final inventory is a snapshot conflict",
      ["state.db-wal", 4],
      true,
    ),
    rejected(
      "shared-memory removal during final inventory is a snapshot conflict",
      ["state.db-shm", 4],
      true,
    ),
  ],
};
