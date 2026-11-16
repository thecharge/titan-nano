import { LiveWorkspaceFixture as Fixture, RunStatus, SnapshotMutation } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const scopedCaptureCases = {
  positive: [
    positive(
      "exact claims prepare and roll back while a disjoint peer writes",
      [false, true],
      true,
    ),
    positive(
      "parent and child claims roll back without overwriting their peer",
      [true, true],
      true,
    ),
  ],
  negative: [
    rejected("an unobserved dependency edit blocks exact-scope acceptance", [false, false], true),
    rejected("an unobserved dependency edit blocks parent-scope acceptance", [true, false], true),
  ],
};

export const scopedRollbackConflictCases = {
  positive: [
    positive("approved rollback keeps a concurrent replacement file", [false, true], {
      state: RunStatus.Failed,
      replacement: Fixture.Person,
      created: false,
      peer: Fixture.Old,
    }),
    positive("approved rollback keeps a regular file replacing a parent", [true, true], {
      state: RunStatus.Failed,
      replacement: Fixture.Person,
      created: false,
      peer: Fixture.Old,
    }),
  ],
  negative: [
    rejected("denied rollback preserves a concurrent replacement", [false, false], {
      state: RunStatus.Blocked,
      replacement: Fixture.Person,
      created: true,
      peer: Fixture.Old,
    }),
    rejected("denied rollback preserves a replaced parent", [true, false], {
      state: RunStatus.Blocked,
      replacement: Fixture.Person,
      created: true,
      peer: Fixture.Old,
    }),
  ],
};

export const scopedDependencyCases = {
  positive: [
    positive("worker dependency remains stable", [true, SnapshotMutation.None], true),
    positive("checker dependency remains stable", [false, SnapshotMutation.None], true),
  ],
  negative: [
    rejected(
      "observed worker dependency outside writes changes",
      [true, SnapshotMutation.Changed],
      true,
    ),
    rejected(
      "observed checker dependency outside writes disappears",
      [false, SnapshotMutation.Deleted],
      true,
    ),
  ],
};

export const scopedRecoveryCases = {
  positive: [
    positive("sealed script result resumes without repeating its command", [true, null], true),
    positive("sealed native result resumes without a second dispatch", [false, null], true),
  ],
  negative: [
    rejected("sealed script result rejects a live edit without rerunning", [true, "live"], true),
    rejected("sealed native result rejects a changed candidate", [false, "candidate"], true),
  ],
};
