import { positive, rejected } from "@titan/test-factories";

export const retainedSkillExecutionCases = {
  positive: [
    positive("isolated generated-cache reads retain and verify their source", ["cache"], true),
    positive("live instruction changes preserve admitted skill execution", ["changed"], true),
    positive("live reference changes preserve admitted reference reads", ["reference"], true),
  ],
  negative: [
    rejected("cyclic skill roots preserve the filesystem error", ["loop"], true),
    rejected("altered retained instructions block before execution", ["tampered"], true),
    rejected("altered retained references block managed reads", ["hash"], true),
  ],
};

export const workspaceRunInspectionCases = {
  positive: [
    positive("project run filters and compact watch use the admitted project", ["project"], true),
    positive("compact status retains pending human decision identifiers", ["waiting"], true),
    positive("known-home inspection retains reachable registered homes", ["known"], true),
  ],
  negative: [
    rejected("oversized home pages retain a bounded diagnostic", ["oversized"], true),
    rejected("aggregate home pages stop at their byte budget", ["pagination"], true),
    rejected("unavailable homes retain their own diagnostic", ["unavailable"], true),
    rejected("conflicting project selectors are refused", ["conflict"], true),
    rejected("compact inspection refuses a projection ahead of the run", ["projection"], true),
  ],
};

export const retainedScriptExecutionCases = {
  positive: [
    positive("script checks and proofs retain their candidate chain", ["check"], true),
    positive("script proof outputs assemble with their committed hash", ["proof"], true),
  ],
  negative: [
    rejected("changed retained proof outputs block the next dispatch", ["tampered"], true),
    rejected("external writes after proof completion block acceptance", ["external"], true),
  ],
};

export const retainedImproverExecutionCases = {
  positive: [
    positive("improver reads the retained skill reference", ["read"], true),
    positive("improver releases the retained skill binding after execution", ["close"], true),
  ],
  negative: [
    rejected("expired improver execution cannot read a retained skill", ["stale"], true),
    rejected("improver cannot use retained skill authority for project files", ["outside"], true),
  ],
};
