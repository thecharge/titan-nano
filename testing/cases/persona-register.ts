import { ErrorCode, ExitCode, PersonaHomeSource, PersonaRegister } from "@titan/constants";
import { KnowledgeMessage, personaNotInRegister } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const personaMutationInheritanceCases = {
  positive: [
    positive("omitted mutation fields inherit parent tools and tags", [false, false], true),
    positive("explicit empty mutation fields clear tools and tags", [true, true], true),
  ],
  negative: [
    rejected("clearing tools cannot erase inherited tags", [true, false], true),
    rejected("clearing tags cannot erase inherited tools", [false, true], true),
  ],
};

export const personaBindingRetryCases = {
  positive: [
    positive("reopened submission binding reuses an inline allocation", [false, false], true),
    positive("reopened submission binding reuses its mutation allocation", [true, false], true),
  ],
  negative: [
    rejected(
      "an intervening registration cannot redirect a retry's inline version",
      [false, true],
      true,
    ),
    rejected("an intervening mutation cannot duplicate a retried allocation", [true, true], true),
    rejected(
      "a changed inline allocation cannot satisfy a binding retry",
      [false, false, true],
      true,
    ),
    rejected(
      "a changed mutation allocation cannot satisfy a binding retry",
      [true, false, true],
      true,
    ),
    rejected(
      "a changed mutation parent cannot satisfy a binding retry",
      [true, false, true, true],
      true,
    ),
  ],
};

export const personaShowPageCases = {
  positive: [
    positive("persona inspection accepts a one-version page", ["1", "3", true], true),
    positive("persona inspection continues before an exact version", ["2", "2", true], true),
  ],
  negative: [
    rejected("persona inspection refuses a zero page size", ["0", "3", false], true),
    rejected("persona inspection refuses an oversized page", ["201", "3", false], true),
    rejected("persona inspection refuses exponent option syntax", ["1e2", "3", false], true),
    rejected("persona inspection refuses a zero version cursor", ["1", "0", false], true),
  ],
};

export const personaShowCases = {
  positive: [
    positive(
      "persona show lists saved versions and follows a bounded cursor",
      [PersonaRegister.Judge, false],
      true,
    ),
    positive(
      "persona show retains access to an exact older version",
      [PersonaRegister.JudgeFirst, false],
      true,
    ),
  ],
  negative: [
    rejected("persona show refuses an absent name", [PersonaRegister.Fixer, true], true),
    rejected("persona show refuses an absent version", [PersonaRegister.JudgeMissing, true], true),
    rejected("persona show refuses a path selector", ["../judge", true], true),
  ],
};

export const personaFromRunCases = {
  positive: [
    positive(
      "new persona fixer is saved as version 1 and the run record names fixer@1",
      [PersonaRegister.Fixer, 1, false],
      "true fixer@1",
    ),
    positive(
      "second run of an unchanged judge keeps version 1 in the run record",
      [PersonaRegister.Judge, 2, false],
      "true judge@1",
    ),
  ],
  negative: [
    rejected(
      "dry run saves no persona and writes no run record",
      [PersonaRegister.Fixer, 1, true],
      "false none",
    ),
    rejected(
      "no run saves no persona and writes no run record",
      [PersonaRegister.Fixer, 0, false],
      "false none",
    ),
  ],
};

export const personaHomeCases = {
  positive: [
    positive(
      "fixer goes to the TITAN_HOME folder and nothing to the user home",
      [PersonaRegister.Fixer, PersonaHomeSource.Environment],
      "true false false",
    ),
    positive(
      "judge goes to the TITAN_HOME folder and nothing to the user home",
      [PersonaRegister.Judge, PersonaHomeSource.Environment],
      "true false false",
    ),
  ],
  negative: [
    rejected(
      "the home option wins over TITAN_HOME for fixer",
      [PersonaRegister.Fixer, PersonaHomeSource.Option],
      "false true false",
    ),
    rejected(
      "the home option wins over TITAN_HOME for judge",
      [PersonaRegister.Judge, PersonaHomeSource.Option],
      "false true false",
    ),
  ],
};

export const personaMutateCases = {
  positive: [
    positive(
      "mutating judge@1 saves judge@3 and leaves judge@1 and judge@2 unchanged",
      [PersonaRegister.JudgeFirst, PersonaRegister.RoleMutated],
      "judge@3 3 judge@1 Judge with new role true true",
    ),
    positive(
      "mutating judge@2 saves judge@3 with parent judge@2",
      [PersonaRegister.JudgeSecond, PersonaRegister.RoleFirst],
      "judge@3 3 judge@2 Judge fairly true true",
    ),
  ],
  negative: [
    negative(
      "mutating a judge version that is not in the register fails",
      [PersonaRegister.JudgeMissing, PersonaRegister.RoleMutated],
      {
        code: ErrorCode.UnknownPersona,
        message: personaNotInRegister(PersonaRegister.JudgeMissing),
      },
    ),
    negative(
      "mutating a persona that was never saved fails",
      [PersonaRegister.First, PersonaRegister.RoleMutated],
      { code: ErrorCode.UnknownPersona, message: personaNotInRegister(PersonaRegister.First) },
    ),
  ],
};

const corrupt = { code: ErrorCode.KnowledgeCorrupt, message: KnowledgeMessage.Corrupt };

export const personaDefinitionUpdateCases = {
  positive: [
    positive(
      "single updates retain the definition while changing lifecycle metadata",
      [false, false, false],
      true,
    ),
    positive(
      "batch publication retains the definition while changing lifecycle metadata",
      [true, false, false],
      true,
    ),
  ],
  negative: [
    rejected("single updates cannot rewrite a saved persona role", [false, true, false], true),
    rejected("batch publication cannot rewrite a saved persona role", [true, true, false], true),
    rejected("single updates cannot replace a saved persona version", [false, true, true], true),
    rejected("batch publication cannot replace a saved persona version", [true, true, true], true),
    rejected(
      "single updates cannot replace an allocation identity",
      [false, false, false, true],
      true,
    ),
    rejected(
      "batch publication cannot replace an allocation identity",
      [true, false, false, true],
      true,
    ),
  ],
};

export const personaEntryCases = {
  positive: [
    positive(
      "a registered judge version 1 loads as a valid persona entry",
      [1, false],
      "persona judge@1 1 true",
    ),
    positive(
      "a registered judge version 3 loads as a valid persona entry",
      [3, false],
      "persona judge@3 1 true",
    ),
  ],
  negative: [
    negative("a register entry with a wrong kind is corrupt", [1, true], corrupt),
    negative("a register entry of version 2 with a wrong kind is corrupt", [2, true], corrupt),
  ],
};

export const personaOpenCases = {
  positive: [
    positive("the hub opens on a folder with one register entry", [1, false], "persona judge@1"),
    positive("the hub opens on a folder with two register entries", [2, false], "persona judge@2"),
  ],
  negative: [
    negative("the hub refuses a folder with a broken register entry", [1, true], corrupt),
    negative("the hub refuses a folder with a broken first of two entries", [2, true], corrupt),
  ],
};

export const personaRegisterUseCases = {
  positive: [
    positive(
      "a use of judge@1 keeps the reference and saves fixer@1",
      [PersonaRegister.JudgeFirst, 2],
      "judge@1 fixer@1",
    ),
    positive(
      "a use of judge@2 keeps the reference and saves fixer@1",
      [PersonaRegister.JudgeSecond, 2],
      "judge@2 fixer@1",
    ),
  ],
  negative: [
    negative("a use of a version not in the register fails", [PersonaRegister.JudgeMissing, 2], {
      code: ErrorCode.UnknownPersona,
      message: personaNotInRegister(PersonaRegister.JudgeMissing),
    }),
    negative("a use of a persona never saved fails", [PersonaRegister.JudgeFirst, 0], {
      code: ErrorCode.UnknownPersona,
      message: personaNotInRegister(PersonaRegister.JudgeFirst),
    }),
  ],
};

export const personaRegisterBrokenCases = {
  positive: [
    positive("an unchanged judge keeps judge@1", [false], PersonaRegister.JudgeFirst),
    positive("an unchanged judge keeps judge@1 on a second look", [false], "judge@1"),
  ],
  negative: [
    negative("a broken judge@1 entry stops the register", [true], corrupt),
    negative("a broken judge@1 entry is not replaced", [true], corrupt),
  ],
};

export const personaUseCases = {
  positive: [
    positive(
      "titan check passes for the newest version in the register",
      [PersonaRegister.Latest, PersonaRegister.Versions],
      ExitCode.Success,
    ),
    positive(
      "titan check passes for the oldest version in the register",
      [PersonaRegister.First, PersonaRegister.Versions],
      ExitCode.Success,
    ),
  ],
  negative: [
    negative(
      "titan check fails for skeptic@9 when the register holds versions 1 to 5",
      [PersonaRegister.Missing, PersonaRegister.Versions],
      { code: ErrorCode.UnknownPersona, message: personaNotInRegister(PersonaRegister.Missing) },
    ),
    negative(
      "titan check fails for the first version after the newest",
      [PersonaRegister.Beyond, PersonaRegister.Versions],
      { code: ErrorCode.UnknownPersona, message: personaNotInRegister(PersonaRegister.Beyond) },
    ),
  ],
};

export const personaRegistryOwnerCases = {
  positive: [
    positive(
      "concurrent identical registrations share their catalog version",
      [false, false],
      "4 2",
    ),
    positive(
      "concurrent changed registrations receive distinct catalog versions",
      [true, false],
      "4 5",
    ),
    positive(
      "concurrent identical mutations allocate distinct immutable versions",
      [false, false, true],
      "4 6",
    ),
    positive(
      "concurrent changed mutations allocate distinct immutable versions",
      [true, false, true],
      "4 6",
    ),
  ],
  negative: [
    negative("a closed owner refuses identical persona registration", [false, true], {
      code: ErrorCode.KnowledgeUnavailable,
      message: KnowledgeMessage.Unavailable,
    }),
    negative("a closed owner refuses changed persona registration", [true, true], {
      code: ErrorCode.KnowledgeUnavailable,
      message: KnowledgeMessage.Unavailable,
    }),
  ],
};

export const personaRegistryRecoveryCases = {
  positive: [
    positive("reopened catalog reuses a registered version", [false, false], "false judge@1"),
    positive(
      "reopened catalog preserves the original persona identity",
      [false, true],
      "false judge@1",
    ),
  ],
  negative: [
    rejected(
      "interrupted journal publication recovers without allocating another version",
      [true, false],
      "true judge@1",
    ),
    rejected(
      "interrupted index publication recovers without allocating another version",
      [true, true],
      "true judge@1",
    ),
  ],
};

export const personaResolvedRunCases = {
  positive: [
    positive(
      "HTTP runs resolve a saved persona and preserve source identity",
      [false, false, false],
      true,
    ),
    positive("HTTP runs pin a persona mutation across daemon restart", [true, true, false], true),
    positive("a saved persona remains pinned across daemon restart", [false, true, false], true),
    positive(
      "a persona mutation reuses its submission without dispatch",
      [true, false, false],
      true,
    ),
    positive("CLI runs use a saved persona across restart", [false, true, false, true], true),
    positive("CLI runs execute a saved persona mutation", [true, false, false, true], true),
  ],
  negative: [
    rejected(
      "an absent saved persona refuses HTTP admission before dispatch",
      [false, false, true],
      true,
    ),
    rejected(
      "an absent mutation parent refuses HTTP admission before dispatch",
      [true, true, true],
      true,
    ),
    rejected("CLI admission refuses an absent saved persona", [false, false, true, true], true),
    rejected("CLI admission refuses an absent mutation parent", [true, false, true, true], true),
  ],
};

export const personaRegistryIdentityCases = {
  positive: [
    positive("a saved persona body matches its immutable name and version", [false, false], true),
    positive(
      "unchanged registration preserves its immutable persona identity",
      [true, false],
      true,
    ),
  ],
  negative: [
    negative("a persona body cannot substitute another name", [false, true], corrupt),
    negative("a persona body cannot substitute another version", [true, true], corrupt),
  ],
};

export const personaConcurrentSubmissionsCases = {
  positive: [
    positive("two HTTP runs assign distinct versions to identical mutations", [false, false], true),
    positive("two HTTP runs assign distinct versions to changed mutations", [true, false], true),
  ],
  negative: [
    negative(
      "concurrent identical mutations refuse an absent parent without dispatch",
      [false, true],
      {
        code: ErrorCode.UnknownPersona,
        message: personaNotInRegister(PersonaRegister.JudgeMissing),
      },
    ),
    negative(
      "concurrent changed mutations preserve the original registered version",
      [true, true],
      {
        code: ErrorCode.UnknownPersona,
        message: personaNotInRegister(PersonaRegister.JudgeMissing),
      },
    ),
  ],
};
