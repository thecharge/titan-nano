import { positive, rejected } from "@titan/test-factories";

export const modelForCases = {
  positive: [
    positive("the default applies to a persona without a model", ["sonnet", undefined], "sonnet"),
    positive("the persona model wins", ["sonnet", "opus"], "opus"),
  ],
  negative: [
    rejected("no model anywhere gives no model", [null, undefined], null),
    rejected("a persona model without a default is kept", [null, "haiku"], "haiku"),
  ],
};

export const modelSettingCases = {
  positive: [
    positive("sonnet is a name without a version", ["sonnet"], { ok: true, model: "sonnet" }),
    positive("haiku is a name without a version", ["haiku"], { ok: true, model: "haiku" }),
  ],
  negative: [
    rejected("a dated version is refused", ["claude-opus-5-5"], {
      ok: false,
      path: "model",
      message: "defaults.model must be a model name without a version",
    }),
    rejected("a version after a dash is refused", ["model-4"], {
      ok: false,
      path: "model",
      message: "defaults.model must be a model name without a version",
    }),
  ],
};
