import { ErrorCode, OpenCallTamper, PersonaState } from "@titan/constants";
import { BoardMessage, RunnerMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const terminal = { code: ErrorCode.TerminalRun, message: RunnerMessage.TerminalRun };

const corrupt = { code: ErrorCode.CorruptBoard, message: BoardMessage.Record };

export const registeredOpenCallDocumentCases = {
  positive: [
    positive(
      "malformed generic persona notes do not block registered selection",
      [true, false],
      true,
    ),
    positive("structured generic persona notes remain outside the register", [false, false], true),
  ],
  negative: [
    rejected("malformed YAML in a registered persona is typed corruption", [true, true], true),
    rejected(
      "invalid definitions in a registered persona are typed corruption",
      [false, true],
      true,
    ),
  ],
};

export const programOpenCallCases = {
  positive: [
    positive(
      "program API retains an old version beside its trial update",
      [PersonaState.NeedsUpdate, true],
      true,
    ),
    positive(
      "program API selects from both eligible trial versions",
      [PersonaState.Trial, true],
      true,
    ),
    positive(
      "program API records both eligible proven versions",
      [PersonaState.Proven, true],
      true,
    ),
  ],
  negative: [
    rejected("program API excludes proposed versions", [PersonaState.Proposed, true], true),
    rejected("program API waits when no tags match", [PersonaState.Proven, false], true),
  ],
};

export const serverOpenCallProcessCases = {
  positive: [
    positive("CLI daemon executes a saved trial persona", [PersonaState.Trial, true, false], true),
    positive("CLI daemon restores its saved pick", [PersonaState.Proven, true, true], true),
  ],
  negative: [
    rejected("CLI daemon refuses a proposed persona", [PersonaState.Proposed, true, false], true),
    rejected("CLI daemon retains an unmatched request", [PersonaState.Proven, false, true], true),
  ],
};

export const serverOpenCallCases = {
  positive: [
    positive(
      "daemon selects an eligible saved persona and records its quality",
      [PersonaState.Trial, true, false],
      true,
    ),
    positive(
      "daemon replay retains its selected persona after restart",
      [PersonaState.Proven, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "invalid selected backend leaves a running peer intact",
      [PersonaState.Trial, true, false, true],
      true,
    ),
    rejected(
      "selected backend failure remains recoverable after restart",
      [PersonaState.Proven, true, true, true],
      true,
    ),
    rejected("daemon cannot select a proposed persona", [PersonaState.Proposed, true, false], true),
    rejected(
      "daemon retains one unmatched call request through restart",
      [PersonaState.Proven, false, true],
      true,
    ),
    rejected(
      "daemon cannot select a retired persona through restart",
      [PersonaState.Retired, true, true],
      true,
    ),
  ],
};

export const openCallTamperCases = {
  positive: [
    positive("an untouched picked run commits again", [OpenCallTamper.None], OpenCallTamper.Ok),
    positive(
      "a picked run with no tamper kind named commits again",
      [OpenCallTamper.Event],
      OpenCallTamper.Ok,
    ),
  ],
  negative: [
    negative(
      "a pick for a step that is not in the plan is refused",
      [OpenCallTamper.UnknownStep],
      corrupt,
    ),
    negative(
      "a pick that names another persona is refused",
      [OpenCallTamper.OtherPersona],
      corrupt,
    ),
    negative("a pick whose task was changed is refused", [OpenCallTamper.OtherTask], corrupt),
    negative(
      "a pick whose persona is missing from the workflow is refused",
      [OpenCallTamper.GhostPersona],
      corrupt,
    ),
  ],
};

export const openCallResumeCases = {
  positive: [
    positive(
      "a tax-law call resumed twice keeps one new persona request",
      [["tax-law"], ["chemistry"], "proven", 2],
      "waiting|||tax-law:Check the reaction",
    ),
    positive(
      "a tax-law call with an empty register resumed once keeps one request",
      [["tax-law"], ["chemistry"], "none", 1],
      "waiting|||tax-law:Check the reaction",
    ),
  ],
  negative: [
    negative(
      "a resume of a call that a chemist answered is refused",
      [["chemistry"], ["chemistry"], "proven", 1],
      terminal,
    ),
    negative(
      "a resume of a call that a trial chemist answered is refused",
      [["chemistry"], ["chemistry"], "trial", 1],
      terminal,
    ),
  ],
};

export const openCallAnsweredCases = {
  positive: [
    positive(
      "a proven chemist answers the chemistry call",
      [["chemistry"], ["chemistry"], "proven"],
      "passed|chemist@2|chemist@2:thompson|",
    ),
    positive(
      "a trial chemist with more tags answers the chemistry call",
      [["chemistry"], ["chemistry", "lab"], "trial"],
      "passed|chemist@2|chemist@2:thompson|",
    ),
  ],
  negative: [
    rejected(
      "a retired chemist is not picked",
      [["chemistry"], ["chemistry"], "retired"],
      "waiting|||chemistry:Check the reaction",
    ),
    rejected(
      "a proposed chemist is not picked",
      [["chemistry"], ["chemistry"], "proposed"],
      "waiting|||chemistry:Check the reaction",
    ),
  ],
};

export const openCallMissCases = {
  positive: [
    positive(
      "a tax-law call with only a chemist sends a new persona request",
      [["tax-law"], ["chemistry"], "proven"],
      "waiting|||tax-law:Check the reaction",
    ),
    positive(
      "a tax-law call with an empty register sends a new persona request",
      [["tax-law"], ["chemistry"], "none"],
      "waiting|||tax-law:Check the reaction",
    ),
  ],
  negative: [
    rejected(
      "a tax-law persona in the register means no request",
      [["tax-law"], ["tax-law"], "proven"],
      "passed|chemist@2|chemist@2:thompson|",
    ),
    rejected(
      "a needs_update tax-law persona means no request",
      [["tax-law"], ["tax-law"], "needs_update"],
      "passed|chemist@2|chemist@2:thompson|",
    ),
  ],
};

export const openCallIndependentCheckerCases = {
  positive: [
    positive("an open worker call uses another version than its checker", [true, false], true),
    positive("independent worker selection survives daemon restart", [true, true], true),
  ],
  negative: [
    rejected("a call with only its checker available waits without dispatch", [false, false], true),
    rejected("restart cannot let a checker become its own worker", [false, true], true),
  ],
};

export const openCallResolverBoundaryCases = {
  positive: [
    positive("a resolver may select an independent worker version", [false, false], true),
    positive("a programmatic independent selection survives reload", [false, true], true),
  ],
  negative: [
    rejected("a resolver cannot ignore the configured checker exclusion", [true, false], true),
    rejected("reload cannot authorize a resolver's forbidden self-check", [true, true], true),
  ],
};

export const openCallLargeRegisterCases = {
  positive: [
    positive(
      "persona-lifecycle > More than ten matching versions: all twenty trial versions have equal selection intervals",
      [PersonaState.Trial, false],
      true,
    ),
    positive(
      "persona-lifecycle > More than ten matching versions: excluding a checker preserves nineteen equal intervals",
      [PersonaState.Proven, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "twenty retired versions leave no callable persona",
      [PersonaState.Retired, false],
      true,
    ),
    rejected(
      "twenty proposed versions leave no callable persona",
      [PersonaState.Proposed, true],
      true,
    ),
  ],
};
