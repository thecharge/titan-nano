import { negative, positive, rejected } from "@titan/test-factories";
export const loadedPolicyCases = {
  positive: [
    positive("installed policy", ["valid"], true),
    positive("second independent policy", ["second"], true),
  ],
  negative: [
    negative("secret rules cannot be empty", ["secrets"], {}),
    negative("message rules cannot be empty", ["commits"], {}),
    negative("an injected live-call workflow is refused", ["ci-live"], {}),
    negative("an injected workflow cannot ignore gate failure", ["ci-ignored"], {}),
    negative("a manual workflow with another extension is refused", ["ci-manual"], {}),
    negative("a hidden workflow file is refused", ["ci-hidden"], {}),
  ],
};
export const messageCommandCases = {
  positive: [positive("valid subject", ["valid"], 0), positive("scoped subject", ["scoped"], 0)],
  negative: [
    rejected("missing file selector", ["missing"], 1),
    rejected("invalid subject", ["invalid"], 1),
  ],
};
export const hookFailureCases = {
  positive: [
    positive("known policy diagnostic", ["known"], 1),
    positive("known output diagnostic", ["output"], 1),
  ],
  negative: [
    rejected("unknown error is masked", ["unknown"], 1),
    rejected("non-error is masked", ["null"], 1),
  ],
};
export const hookProcessCases = {
  positive: [
    positive("trimmed output", ["trim"], "checked"),
    positive("raw output retained", ["raw"], " checked "),
  ],
  negative: [negative("bounded output", ["limit"], {}), negative("failed child", ["failure"], {})],
};
export const guardedProcessCases = {
  positive: [positive("command array", ["array"], 0), positive("command object", ["object"], 0)],
  negative: [
    negative("unexpected executable", ["blocked"], {}),
    negative("invalid executable", ["invalid"], {}),
  ],
};
export const binaryContainmentCases = {
  positive: [
    positive("cached binary", ["first"], true),
    positive("another cached binary", ["second"], true),
  ],
  negative: [
    negative("binary outside cache", ["escape"], {}),
    negative("another escape", ["escape-second"], {}),
  ],
};
export const graphManifestCases = {
  positive: [
    positive("public export", ["valid"], []),
    positive("second valid graph", ["second"], []),
  ],
  negative: [
    rejected("duplicate names", ["duplicate"], ["duplicate-package"]),
    rejected("missing public contract", ["missing"], ["public-contract"]),
  ],
};
