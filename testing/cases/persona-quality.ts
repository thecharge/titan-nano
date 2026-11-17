import {
  Backend,
  KnowledgePublicationStage,
  NativeToolRole,
  PersonaState,
  Verdict,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const personaSamplingCases = {
  positive: [
    positive(
      "a survived result fades its exact tag group and preserves Wilson totals",
      [false],
      true,
    ),
    positive("a refuted result updates separate faded sampling counts", [true], true),
    positive(
      "a grouped sampling journal recovers once",
      [false, false, false, KnowledgePublicationStage.Journal],
      true,
    ),
    positive(
      "a grouped sampling index recovers once",
      [false, false, false, KnowledgePublicationStage.Index],
      true,
    ),
  ],
  negative: [
    rejected("terminal replay cannot fade a tag group twice", [false, true], true),
    rejected(
      "a sampling group over the entry limit preserves every version",
      [false, false, false, KnowledgePublicationStage.Journal, true],
      true,
    ),
    rejected(
      "a sampling group over the byte limit preserves every version",
      [false, false, false, KnowledgePublicationStage.Index, true],
      true,
    ),
    rejected(
      "an interrupted worker cannot fade or train sampling counts",
      [false, true, true],
      true,
    ),
  ],
};

export const personaUsageReplayCases = {
  positive: [
    positive("identical usage delivery leaves the saved version unchanged", [0], true),
    positive("an older usage prefix leaves the saved version unchanged", [1], true),
    positive("a later usage prefix replaces its earlier subtotal", [7], true),
    positive("a legacy usage receipt accepts its first asked subtotal", [9], true),
    positive("a later usage prefix retains an increased asked subtotal", [13], true),
    positive(
      "separate runs retain independent usage receipts and their combined totals",
      [8],
      true,
    ),
  ],
  negative: [
    rejected("a retained usage prefix cannot change its token totals", [2], true),
    rejected("a later usage prefix cannot reduce reported token totals", [3], true),
    rejected("a usage report cannot claim another run", [4], true),
    rejected("a usage report cannot exceed the committed run prefix", [5], true),
    rejected("a usage report cannot claim an unbound persona version", [6], true),
    rejected("a retained usage prefix cannot change its asked subtotal", [10], true),
    rejected("a later usage prefix cannot drop its asked subtotal", [11], true),
    rejected("a later usage prefix cannot decrease its asked subtotal", [12], true),
  ],
};

export const personaUsageProductionCases = {
  positive: [
    positive(
      "Claude worker usage is retained separately from checker usage",
      [Backend.Claude],
      true,
    ),
    positive(
      "Codex worker usage survives owner restart and executable inspection",
      [Backend.Codex],
      true,
    ),
  ],
  negative: [
    rejected(
      "missing backend cost cannot claim complete per-version cost",
      [Backend.Codex, true],
      true,
    ),
    rejected(
      "interrupted workers retain usage without a quality outcome",
      [Backend.Claude, false, true],
      true,
    ),
    rejected(
      "legacy versions cannot claim complete historical usage",
      [Backend.Codex, false, false, true],
      true,
    ),
  ],
};

export const personaLaterResultCases = {
  positive: [
    positive(
      "a passed checker can retain a later refutation",
      [NativeToolRole.Checker, Verdict.Survived, true],
      true,
    ),
    positive(
      "a legacy worker result needs no later-check observation",
      [NativeToolRole.Worker, Verdict.Refuted, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "a worker cannot claim a checker pass",
      [NativeToolRole.Worker, Verdict.Survived, true],
      false,
    ),
    rejected(
      "a refuting checker cannot claim a passed result",
      [NativeToolRole.Checker, Verdict.Refuted, true],
      false,
    ),
  ],
};

export const personaProductionLifecycleCases = {
  positive: [
    positive(
      "daemon promotes seventeen surviving results out of twenty",
      [PersonaState.Trial, 16, 3, false, PersonaState.Proven, false, false],
      true,
    ),
    positive(
      "daemon requests improvement for a weak proven version",
      [PersonaState.Proven, 1, 6, true, PersonaState.NeedsUpdate, true, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "large refutation evidence retains a bounded improvement request",
      [PersonaState.Trial, 1, 6, true, PersonaState.NeedsUpdate, false, true],
      true,
    ),
    rejected(
      "sixteen surviving results do not promote a trial version",
      [PersonaState.Trial, 15, 4, false, PersonaState.Trial, true, false],
      true,
    ),
    rejected(
      "quality results cannot approve a proposed persona",
      [PersonaState.Proposed, 16, 3, false, PersonaState.Proposed, true, false],
      true,
    ),
    rejected(
      "a weak trial version retains one improvement request",
      [PersonaState.Trial, 1, 6, true, PersonaState.NeedsUpdate, true, false],
      true,
    ),
  ],
};

export const personaLifecycleDeliveryCases = {
  positive: [
    positive(
      "project trial improvement retains its scope",
      [PersonaState.Trial, false, false, true],
      true,
    ),
    positive(
      "project proven improvement retains its scope",
      [PersonaState.Proven, false, false, true],
      true,
    ),
    positive(
      "trial transition and improvement request survive recreation",
      [PersonaState.Trial, false, false],
      true,
    ),
    positive(
      "proven transition and improvement request survive recreation",
      [PersonaState.Proven, false, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "interrupted project offer retains scope on replay",
      [PersonaState.Trial, true, false, true],
      true,
    ),
    rejected(
      "project acknowledgement replay preserves exact scope",
      [PersonaState.Proven, false, true, true],
      true,
    ),
    rejected(
      "interrupted request delivery resumes from the retained transition",
      [PersonaState.Trial, true, false],
      true,
    ),
    rejected(
      "interrupted acknowledgement cannot duplicate the durable request",
      [PersonaState.Proven, false, true],
      true,
    ),
  ],
};

export const personaHistoryWithoutTotalsCases = {
  positive: [
    positive("retained history reconstructs missing survival totals", [false, false], true),
    positive("retained history reconstructs worker and checker refutations", [true, false], true),
  ],
  negative: [
    rejected("reconstructed survival totals resist duplicate delivery", [false, true], true),
    rejected("reconstructed refutations resist duplicate delivery", [true, true], true),
  ],
};

export const personaLegacyQualityCases = {
  positive: [
    positive("legacy aggregate counts survive their first durable results", [false, false], true),
    positive("empty result history preserves earlier aggregate counts", [true, false], true),
  ],
  negative: [
    rejected("replay cannot duplicate newly imported legacy outcomes", [false, true], true),
    rejected("replay cannot reset legacy counters with an empty history", [true, true], true),
  ],
};

export const personaProductionHistoryCases = {
  positive: [
    positive(
      "persona show lists three survived outcomes for version two",
      [false, false, true],
      true,
    ),
    positive(
      "persona show lists two survived and one refuted result for version two",
      [true, false, true],
      true,
    ),
    positive(
      "actual server records three survived candidates once across restart",
      [false, false],
      true,
    ),
    positive(
      "actual server records two survived candidates and one refutation",
      [true, false],
      true,
    ),
  ],
  negative: [
    rejected("cancelled version two workers retain zero completed uses", [false, true, true], true),
    rejected("interrupted version two checks retain zero completed uses", [true, true, true], true),
    rejected("cancelled workers produce no survived or refuted result", [false, true], true),
    rejected("interrupted checks produce no candidate quality result", [true, true], true),
  ],
};

export const personaLaterCheckCases = {
  positive: [
    positive("a later persona refutes an earlier checker's pass once", [false, true, false], true),
    positive(
      "an approved later script refutes an earlier checker's pass once",
      [false, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "an earlier refutation cannot invalidate a later passing check",
      [true, false, false],
      true,
    ),
    rejected(
      "a later passing script cannot invalidate a passing check",
      [false, false, true],
      true,
    ),
    rejected(
      "a checker that refuted the result cannot acquire a false pass",
      [true, true, false],
      true,
    ),
    rejected("a later passing script preserves an earlier refutation", [true, false, true], true),
  ],
};

export const personaHistoryRecoveryCases = {
  positive: [
    positive(
      "persona-registry > History after a run: reopened history deduplicates worker and checker results",
      [false, false],
      true,
    ),
    positive(
      "persona-registry > History after a run: repeated terminal delivery leaves immutable result identities unchanged",
      [false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "persona-registry > History after a run: interrupted persona journal publication recovers without duplicate outcomes",
      [true, false],
      true,
    ),
    rejected(
      "persona-registry > History after a run: interrupted persona index publication recovers without duplicate outcomes",
      [true, true],
      true,
    ),
  ],
};

export const personaProductionSplitHistoryCases = {
  positive: [
    positive("split candidates retain two distinct part identities", [false, false], true),
    positive("refuted split candidates count each checked part once", [true, false], true),
  ],
  negative: [
    rejected("cancelled split workers produce no quality outcome", [false, true], true),
    rejected("cancelled split checks produce no quality outcome", [true, true], true),
  ],
};

export const personaHistoryReplayCases = {
  positive: [
    positive("a duplicate terminal history retains its exact version", [false, false], true),
    positive("repeated replay leaves persona totals unchanged", [false, false], true),
  ],
  negative: [
    rejected("replay cannot change an existing candidate verdict", [true, false], true),
    rejected(
      "replay cannot turn a retained checker result into another use by changing its later check",
      [false, false, true],
      true,
    ),
    rejected("a terminal run cannot publish another run's outcomes", [false, true], true),
  ],
};

export const personaTerminalHistoryRecoveryCases = {
  positive: [
    positive(
      "terminal success publishes persona outcomes through the engine",
      [false, false, false],
      true,
    ),
    positive(
      "terminal refutation publishes persona outcomes through the engine",
      [true, false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "interrupted successful history resumes without another vendor execution",
      [false, true, false],
      true,
    ),
    rejected(
      "interrupted refuted history restores its intended terminal state",
      [true, true, true],
      true,
    ),
  ],
};
