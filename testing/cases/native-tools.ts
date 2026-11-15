import { KnowledgeKind, NativeTool, NativeToolRole } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeFileServiceCases = {
  positive: [
    positive(
      "file service returns an audited missing observation",
      [NativeTool.ReadFile, true],
      true,
    ),
    positive(
      "listing service returns an audited empty inventory",
      [NativeTool.ListFiles, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "unavailable file service returns an audited refusal",
      [NativeTool.ReadFile, false],
      true,
    ),
    rejected(
      "unavailable listing service returns an audited refusal",
      [NativeTool.ListFiles, false],
      true,
    ),
  ],
};

export const nativeKnowledgeOwnershipCases = {
  positive: [
    positive(
      "worker fact becomes final only through host publication",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "worker lesson becomes final only through host publication",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected("discarded worker fact cannot leak to a peer run", [KnowledgeKind.Fact, true], true),
    rejected(
      "discarded worker lesson cannot leak to a peer run",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};

export const nativeKnowledgeReadOnlyCases = {
  positive: [
    positive(
      "checker reads final facts through its exact policy",
      [KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "checker reads final lessons through its exact policy",
      [KnowledgeKind.Lesson, false],
      true,
    ),
  ],
  negative: [
    rejected("fact checker cannot acquire worker or human tools", [KnowledgeKind.Fact, true], true),
    rejected(
      "lesson checker cannot acquire worker or human tools",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};

export const nativeAuthorityLifecycleCases = {
  positive: [
    positive("worker revocation frees its bounded slot", [NativeToolRole.Worker, false], true),
    positive("checker revocation frees its bounded slot", [NativeToolRole.Checker, false], true),
  ],
  negative: [
    rejected("obsolete worker authority cannot call tools", [NativeToolRole.Worker, true], true),
    rejected("obsolete checker authority cannot call tools", [NativeToolRole.Checker, true], true),
  ],
};

export const nativeAuthorityDrainCases = {
  positive: [
    positive("accepted fact call drains before revocation", [KnowledgeKind.Fact, false], true),
    positive("accepted lesson call drains before revocation", [KnowledgeKind.Lesson, false], true),
  ],
  negative: [
    rejected(
      "failed fact publication cannot leak native authority",
      [KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "failed lesson publication cannot leak native authority",
      [KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};

export const nativeAuthorityGuardsCases = {
  positive: [
    positive("worker transport admits only its exact policy", [NativeToolRole.Worker, false], true),
    positive(
      "checker transport admits only its exact policy",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected("browser origin cannot use worker credentials", [NativeToolRole.Worker, true], true),
    rejected("browser origin cannot use checker credentials", [NativeToolRole.Checker, true], true),
  ],
};

export const nativeAuthorityQueuedCases = {
  positive: [
    positive(
      "revoked worker refuses an already queued request",
      [NativeToolRole.Worker, false],
      true,
    ),
    positive(
      "revoked checker refuses an already queued request",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected("obsolete worker cannot execute queued work", [NativeToolRole.Worker, true], true),
    rejected("obsolete checker cannot execute queued work", [NativeToolRole.Checker, true], true),
  ],
};
