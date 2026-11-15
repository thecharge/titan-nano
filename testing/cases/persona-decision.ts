import { RequestKind } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const personaDecisionProcessCases = {
  positive: [
    positive(
      "human approval archives a persona and preserves version numbering",
      [RequestKind.DeletePersona, true],
      true,
    ),
    positive(
      "approved persona creation moves its frozen version into trial",
      [RequestKind.NewPersona, true],
      true,
    ),
    positive(
      "approved retirement removes its frozen version from eligibility",
      [RequestKind.RetirePersona, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "denied deletion keeps the persona available",
      [RequestKind.DeletePersona, false],
      true,
    ),
    rejected(
      "denied persona creation preserves the proposed state",
      [RequestKind.NewPersona, false],
      true,
    ),
    rejected(
      "denied retirement preserves the original state",
      [RequestKind.RetirePersona, false],
      true,
    ),
  ],
};

export const personaDecisionRecoveryCases = {
  positive: [
    positive("persona deletion retries before its first publication", ["delete-before"], true),
    positive("persona deletion recovers its state journal", ["delete-journal"], true),
    positive("persona deletion finishes after its state index", ["delete-index"], true),
    positive(
      "persona deletion recovers after archiving its current file",
      ["delete-archive"],
      true,
    ),
    positive("a resident engine retries an unpublished approved decision", ["before"], true),
    positive("a journal interruption replays the approved state change once", ["journal"], true),
    positive("an index interruption preserves one decision receipt", ["index"], true),
  ],
  negative: [
    rejected("main authority cannot authorize persona deletion", ["delete-main"], true),
    rejected("a mismatched approved operation cannot change a persona", ["scope"], true),
    rejected("an unversioned approval cannot select a later persona", ["target"], true),
  ],
};
