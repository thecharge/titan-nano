import {
  ErrorCode,
  LiveWorkspaceFixture as Fixture,
  RequestDecision,
  RunStatus,
  WorkspaceModeSetting,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const listed = [Fixture.First];

export const liveReviewCases = {
  positive: [
    positive(
      "a scoped live reviewer uses the shared project and metadata",
      [WorkspaceModeSetting.Live, true],
      { sameTree: true, sharedMetadata: true },
    ),
    positive(
      "a whole-project live reviewer uses the shared project and metadata",
      [WorkspaceModeSetting.Live, false],
      { sameTree: true, sharedMetadata: true },
    ),
  ],
  negative: [
    rejected(
      "explicit isolated review keeps execution in its copy",
      [WorkspaceModeSetting.Isolated, true],
      { sameTree: false, sharedMetadata: false },
    ),
    rejected(
      "explicit isolated whole-tree review keeps execution in its copy",
      [WorkspaceModeSetting.Isolated, false],
      { sameTree: false, sharedMetadata: false },
    ),
  ],
};

export const liveCheckContinuationCases = {
  positive: [
    positive("an unchanged candidate continues its approved check after restart", [null, false], {
      state: RunStatus.Passed,
      checks: 2,
      reviewers: 1,
      reconciliations: 0,
      text: Fixture.New,
    }),
    positive(
      "an unchanged dependency outside the write scope permits continuation",
      [Fixture.Second, false, true],
      { state: RunStatus.Passed, checks: 2, reviewers: 1, reconciliations: 0, text: Fixture.New },
    ),
  ],
  negative: [
    rejected(
      "a changed readable dependency outside the write scope requires fresh reconciliation before delayed checks",
      [Fixture.Second, false],
      { state: RunStatus.Passed, checks: 2, reviewers: 1, reconciliations: 1, text: Fixture.New },
    ),
    rejected(
      "a deleted readable dependency outside the write scope requires fresh reconciliation before delayed checks",
      [Fixture.Second, true],
      { state: RunStatus.Passed, checks: 2, reviewers: 1, reconciliations: 1, text: Fixture.New },
    ),
    rejected(
      "a changed candidate requires its own fresh reconciliation and checks",
      [Fixture.First, false],
      {
        state: RunStatus.Passed,
        checks: 2,
        reviewers: 1,
        reconciliations: 1,
        text: Fixture.Person,
      },
    ),
    rejected(
      "a deleted candidate requires its own fresh reconciliation and checks",
      [Fixture.First, true],
      { state: RunStatus.Passed, checks: 2, reviewers: 1, reconciliations: 1, text: null },
    ),
  ],
};
const written = (text: string) => ({ text, changed: [Fixture.First], state: RunStatus.Passed });
const rolled = (a: string, outside: string | null, c: string | null, state: RunStatus) => ({
  a,
  outside,
  c,
  kept: Fixture.New,
  state,
});

export const liveWriteCases = {
  positive: [
    positive(
      "a live step writes the listed file into the project and the record lists it",
      [WorkspaceModeSetting.Live, listed],
      written(Fixture.New),
    ),
    positive(
      "a live step with no list writes into the project and the record lists the file",
      [WorkspaceModeSetting.Live, null],
      written(Fixture.New),
    ),
  ],
  negative: [
    rejected(
      "isolated mode leaves the project file as it was",
      [WorkspaceModeSetting.Isolated, listed],
      written(Fixture.Old),
    ),
    rejected(
      "isolated mode with no list leaves the project file as it was",
      [WorkspaceModeSetting.Isolated, null],
      written(Fixture.Old),
    ),
  ],
};

export const liveRecordCases = {
  positive: [
    positive(
      "a live step records the file it wrote",
      [WorkspaceModeSetting.Live, 1],
      [Fixture.First],
    ),
    positive(
      "two live steps add their files to the same record",
      [WorkspaceModeSetting.Live, 2],
      [Fixture.First, Fixture.Second],
    ),
  ],
  negative: [
    rejected(
      "an isolated run with one step writes no record",
      [WorkspaceModeSetting.Isolated, 1],
      null,
    ),
    rejected(
      "an isolated run with two steps writes no record",
      [WorkspaceModeSetting.Isolated, 2],
      null,
    ),
  ],
};

export const isolatedModeCases = {
  positive: [
    positive(
      "isolated mode writes to a copy and the project stays the same",
      [WorkspaceModeSetting.Isolated, listed],
      written(Fixture.Old),
    ),
    positive(
      "isolated mode ignores the file list and the project stays the same",
      [WorkspaceModeSetting.Isolated, null],
      written(Fixture.Old),
    ),
  ],
  negative: [
    rejected(
      "live mode changes the project file",
      [WorkspaceModeSetting.Live, listed],
      written(Fixture.New),
    ),
    rejected(
      "live mode with no list changes the project file",
      [WorkspaceModeSetting.Live, null],
      written(Fixture.New),
    ),
  ],
};

export const liveRollbackCases = {
  positive: [
    positive(
      "a refuted step puts back the listed files and keeps the attempt",
      [WorkspaceModeSetting.Live, true, null],
      rolled(Fixture.Old, null, null, RunStatus.Failed),
    ),
    positive(
      "a refuted step puts back files even when a person edited another file",
      [WorkspaceModeSetting.Live, true, Fixture.Second],
      rolled(Fixture.Old, Fixture.Person, null, RunStatus.Failed),
    ),
  ],
  negative: [
    rejected(
      "a step that survives is not rolled back",
      [WorkspaceModeSetting.Live, false, null],
      rolled(Fixture.New, null, Fixture.New, RunStatus.Passed),
    ),
    rejected(
      "isolated mode has nothing to roll back in the project",
      [WorkspaceModeSetting.Isolated, true, null],
      rolled(Fixture.Old, null, null, RunStatus.Failed),
    ),
  ],
};

export const liveOutsideCases = {
  positive: [
    positive(
      "a person edit to another file stays after the step is refuted",
      [WorkspaceModeSetting.Live, true, Fixture.Second],
      rolled(Fixture.Old, Fixture.Person, null, RunStatus.Failed),
    ),
    positive(
      "a person edit inside a folder stays after the step is refuted",
      [WorkspaceModeSetting.Live, true, Fixture.Nested],
      rolled(Fixture.Old, Fixture.Person, null, RunStatus.Failed),
    ),
  ],
  negative: [
    rejected(
      "a person edit stays when the step survives and nothing is put back",
      [WorkspaceModeSetting.Live, false, Fixture.Second],
      rolled(Fixture.New, Fixture.Person, Fixture.New, RunStatus.Passed),
    ),
    rejected(
      "a person edit never reaches the project in isolated mode",
      [WorkspaceModeSetting.Isolated, true, Fixture.Second],
      rolled(Fixture.Old, null, null, RunStatus.Failed),
    ),
  ],
};

export const sameFileCases = {
  positive: [
    positive("two steps on the same file never overlap", [listed, listed], 1),
    positive(
      "a folder and a file inside it never overlap",
      [[Fixture.Folder], [Fixture.Nested]],
      1,
    ),
  ],
  negative: [
    rejected(
      "steps on different files do overlap",
      [[Fixture.First], [Fixture.Second]],
      Fixture.Parallel,
    ),
    rejected(
      "steps on other different files do overlap",
      [[Fixture.Second], [Fixture.Third]],
      Fixture.Parallel,
    ),
  ],
};

export const liveReadClaimCases = {
  positive: [
    positive(
      "readers of the same file continue together",
      [listed, listed, false, false],
      Fixture.Parallel,
    ),
    positive(
      "readers of a folder and nested file continue together",
      [[Fixture.Folder], [Fixture.Nested], false, false],
      Fixture.Parallel,
    ),
  ],
  negative: [
    rejected("a writer yields to an active reader", [listed, listed, false, true], 1),
    rejected(
      "a reader yields to an active writer",
      [[Fixture.Folder], [Fixture.Nested], true, false],
      1,
    ),
    rejected(
      "read-only workers cannot share a write-capable checker scope",
      [listed, listed, false, false, true],
      1,
    ),
    rejected(
      "nested read-only workers yield when their checker can run shell commands",
      [[Fixture.Folder], [Fixture.Nested], false, false, true],
      1,
    ),
  ],
};

export const differentFilesCases = {
  positive: [
    positive(
      "two steps on different files run at the same time",
      [[Fixture.First], [Fixture.Second]],
      Fixture.Parallel,
    ),
    positive(
      "two other steps on different files run at the same time",
      [[Fixture.Second], [Fixture.Third]],
      Fixture.Parallel,
    ),
  ],
  negative: [
    rejected("a step with a list waits for a step with no list", [null, [Fixture.Second]], 1),
    rejected("two steps with no list wait for each other", [null, null], 1),
    rejected("two steps on the same file wait for each other", [listed, listed], 1),
  ],
};

export const putBackCases = {
  positive: [
    positive(
      "a restored file is added and a removed file is deleted",
      [Fixture.Third, Fixture.First],
      [Fixture.Third],
    ),
    positive(
      "a restored file replaces the old text and a missing removal is ignored",
      [Fixture.First, Fixture.Second],
      [Fixture.First],
    ),
  ],
  negative: [
    negative("a restored path outside the folder is refused", [Fixture.Escape, Fixture.First], {
      code: ErrorCode.UnsafePath,
    }),
    negative("a removed path outside the folder is refused", [Fixture.Third, Fixture.Escape], {
      code: ErrorCode.UnsafePath,
    }),
  ],
};

export const liveConcurrentCases = {
  positive: [
    positive(
      "a user edit after the worker finishes survives a refutation",
      [Fixture.First, false, false, true],
      { text: Fixture.Person, state: RunStatus.Waiting },
    ),
    positive(
      "a user edit of a newly created file survives a refutation",
      [Fixture.Third, false, false, true],
      { text: Fixture.Person, state: RunStatus.Waiting },
    ),
    positive(
      "a user deletion after a worker edit is not restored",
      [Fixture.First, false, true, true],
      { text: null, state: RunStatus.Waiting },
    ),
    positive(
      "a user recreation after a worker deletion is not overwritten",
      [Fixture.First, true, false, true],
      { text: Fixture.Person, state: RunStatus.Waiting },
    ),
  ],
  negative: [
    rejected(
      "a surviving verdict cannot publish a candidate after a user edit",
      [Fixture.First, false, false, false],
      { text: Fixture.Person, state: RunStatus.Blocked },
    ),
    rejected(
      "a surviving verdict cannot publish a candidate after a user deletion",
      [Fixture.First, false, true, false],
      { text: null, state: RunStatus.Blocked },
    ),
  ],
};

const shared = (cancel: boolean) => ({
  state: cancel ? RunStatus.Cancelled : RunStatus.Passed,
  starts: cancel ? 0 : 1,
  readAfterYield: cancel ? null : Fixture.New,
  attempts: 1,
  refutations: 0,
  peer: RunStatus.Passed,
});

export const liveSharedCases = {
  positive: [
    positive(
      "a second run negotiates the same file and reads the yielded contents",
      [Fixture.First, Fixture.First, false],
      shared(false),
    ),
    positive(
      "a folder claim yields to a waiting nested-file run automatically",
      [Fixture.Folder, Fixture.Nested, false],
      shared(false),
    ),
  ],
  negative: [
    rejected(
      "cancelling a waiting file claim starts no vendor and releases the scope",
      [Fixture.First, Fixture.First, true],
      shared(true),
    ),
    rejected(
      "cancelling a nested claim leaves the folder owner and later work usable",
      [Fixture.Folder, Fixture.Nested, true],
      shared(true),
    ),
  ],
};

export const liveReconciliationCases = {
  positive: [
    positive(
      "approved reconciliation preserves a concurrent edit and finishes the refusal",
      [Fixture.First, false, false, true, RequestDecision.Approve],
      { text: Fixture.Person, state: RunStatus.Failed },
    ),
    positive(
      "approved reconciliation preserves a concurrently created file",
      [Fixture.Third, false, false, true, RequestDecision.Approve],
      { text: Fixture.Person, state: RunStatus.Failed },
    ),
  ],
  negative: [
    rejected(
      "a denied reconciliation cannot authorize restoring over the user",
      [Fixture.First, false, false, true, RequestDecision.Deny],
      { text: Fixture.Person, state: RunStatus.Blocked },
    ),
    rejected(
      "a newer edit invalidates the previous reconciliation scope",
      [Fixture.First, false, false, true, RequestDecision.Approve, true],
      { text: Fixture.Old, state: RunStatus.Waiting },
    ),
  ],
};
