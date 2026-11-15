import { positive, rejected } from "@titan/test-factories";

export const fileExecutionBindingCases = {
  positive: [
    positive("a listed scope binds its exact execution before dispatch", ["listed"], true),
    positive("a whole-project scope retains its exact execution binding", ["root"], true),
  ],
  negative: [
    rejected("an old attempt cannot bind the active claim", ["stale-attempt"], true),
    rejected("a crossed step cannot bind another step's claim", ["cross-step"], true),
    rejected("a released claim cannot bind a later execution", ["released"], true),
    rejected("an absent phase cannot bind an execution", ["missing-phase"], true),
    rejected("a waiting node cannot bind an execution", ["paused-binding"], true),
    rejected("a former generation cannot reuse a reacquired scope", ["generation"], true),
    rejected(
      "a failed durable binding restores the earlier phase binding",
      ["commit-failure"],
      true,
    ),
  ],
};

export const fileExecutionSpecificationCases = {
  positive: [
    positive("read dependencies retain their exact board binding", ["mixed"], true),
    positive("a scoped native specification carries the board binding", ["listed"], true),
    positive("a root native specification carries the board binding", ["root"], true),
  ],
  negative: [
    rejected("a different dependency list cannot reuse the binding", ["cross-read"], true),
    rejected("a different run cannot reuse the binding", ["cross-run"], true),
    rejected("a different execution cannot reuse the binding", ["cross-execution"], true),
    rejected("a different file list cannot reuse the binding", ["cross-scope"], true),
    rejected("a different access mode cannot reuse the binding", ["cross-mode"], true),
  ],
};

export const fileExecutionValidationCases = {
  positive: [
    positive("a listed script validates its active board binding", ["listed"], true),
    positive("a root script validates its active board binding", ["root"], true),
  ],
  negative: [
    rejected("a production execution cannot omit its binding", ["missing-binding"], true),
    rejected("a binding without its board record cannot dispatch", ["missing-board"], true),
    rejected("a script cannot cross runs", ["cross-run"], true),
    rejected("a script cannot cross executions", ["cross-execution"], true),
    rejected("a script cannot cross phases", ["cross-phase"], true),
    rejected("a script cannot cross attempts", ["cross-attempt"], true),
    rejected("a script cannot cross claim identities", ["cross-claim"], true),
    rejected("a script cannot expand its paths", ["cross-path"], true),
    rejected("a crossed phase execution id cannot dispatch", ["cross-checkpoint"], true),
    rejected("a completed phase cannot dispatch again", ["completed"], true),
    rejected("a waiting phase cannot dispatch", ["paused"], true),
    rejected("a released script claim cannot dispatch", ["released"], true),
  ],
};
