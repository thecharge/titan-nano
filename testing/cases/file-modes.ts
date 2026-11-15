import { ErrorCode, RunStatus, WorkspaceMode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const snapshotModeCases = {
  positive: [
    positive("executable script remains private and runnable", [true, false], {
      executable: true,
      execution: 0,
      privateMode: WorkspaceMode.PrivateExecutable,
      sameHash: true,
      sameIdentity: true,
    }),
    positive("ordinary data remains private and non-executable", [false, false], {
      executable: false,
      execution: null,
      privateMode: WorkspaceMode.PrivateFile,
      sameHash: true,
      sameIdentity: true,
    }),
  ],
  negative: [
    negative("removed source execute flag invalidates its manifest", [true, true], {
      code: ErrorCode.SnapshotChanged,
    }),
    negative("added source execute flag invalidates its manifest", [false, true], {
      code: ErrorCode.SnapshotChanged,
    }),
  ],
};
export const fileModeIdentityCases = {
  positive: [
    positive("identical executable content", [true, true], {
      sameIdentity: true,
      sameTreeHash: true,
      legacyNonExecutable: true,
    }),
    positive("identical ordinary content", [false, false], {
      sameIdentity: true,
      sameTreeHash: true,
      legacyNonExecutable: true,
    }),
  ],
  negative: [
    rejected("added execute flag changes identity", [false, true], {
      sameIdentity: false,
      sameTreeHash: false,
      legacyNonExecutable: true,
    }),
    rejected("removed execute flag changes identity", [true, false], {
      sameIdentity: false,
      sameTreeHash: false,
      legacyNonExecutable: true,
    }),
  ],
};
export const engineFileModeCases = {
  positive: [
    positive("mode-only addition reaches downstream checks and artifacts", [false, false], {
      state: RunStatus.Passed,
      deliveredMode: WorkspaceMode.PrivateExecutable,
      originalPreserved: true,
      refutations: 0,
    }),
    positive("mode-only removal reaches downstream checks and artifacts", [true, false], {
      state: RunStatus.Passed,
      deliveredMode: WorkspaceMode.PrivateFile,
      originalPreserved: true,
      refutations: 0,
    }),
  ],
  negative: [
    rejected("parallel execute flags conflict from an ordinary base", [false, true], {
      state: RunStatus.Blocked,
      deliveredMode: null,
      originalPreserved: true,
      refutations: 0,
    }),
    rejected("parallel execute flags conflict from an executable base", [true, true], {
      state: RunStatus.Blocked,
      deliveredMode: null,
      originalPreserved: true,
      refutations: 0,
    }),
  ],
};
