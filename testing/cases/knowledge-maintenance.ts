import { KnowledgePublicationStage } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeMaintenanceCases = {
  positive: [
    positive("prune reports preserve source files", ["prune-report"], true),
    positive("consolidation reports preserve source files", ["consolidate-report"], true),
    positive("prune archives full text and restore continues history", ["prune-apply"], true),
    positive(
      "consolidation retains source ids, tags and recoverable text",
      ["consolidate-apply"],
      true,
    ),
    positive("old unread entries are reported", ["old-unread"], true),
    positive("old entries already read are retained", ["old-read"], true),
    positive("replaced versions are reported as retained history", ["replaced"], true),
  ],
  negative: [
    rejected("missing replaced text refuses a retained-history report", ["replaced-missing"], true),
    rejected("restoration refuses linked history parents", ["archive-linked"], true),
    rejected("restoration refuses empty version histories", ["archive-empty"], true),
    rejected("restoration refuses invalid version names", ["archive-invalid"], true),
    rejected("restoration refuses corrupted retained text", ["archive-changed"], true),
    rejected("restoration refuses active identity collisions", ["active"], true),
    rejected("restoration refuses missing history", ["missing"], true),
    rejected("invalid maintenance dates are refused", ["invalid"], true),
    rejected("adding an archived identity cannot restart its version history", ["reuse"], true),
  ],
};

export const knowledgeMaintenanceSurfaceCases = {
  positive: [
    positive("HTTP maintenance retains report and restore parity", ["http"], true),
    positive("CLI maintenance defaults to the project hub", ["cli-project"], true),
    positive("CLI maintenance selects the home hub explicitly", ["cli-home"], true),
  ],
  negative: [
    rejected("HTTP restoration refuses missing sources", ["http-missing"], true),
    rejected("HTTP maintenance refuses malformed options", ["http-invalid"], true),
    rejected("CLI maintenance rejects invalid dates before dispatch", ["cli-invalid"], true),
  ],
};

export const knowledgeMaintenanceRecoveryCases = {
  positive: [
    positive(
      "restore recovers its durable intent after restart",
      [KnowledgePublicationStage.Journal],
      true,
    ),
    positive(
      "restore recovers retained history after restart",
      [KnowledgePublicationStage.History],
      true,
    ),
  ],
  negative: [
    rejected(
      "interrupted file publication retains the full restored entry",
      [KnowledgePublicationStage.File],
      true,
    ),
    rejected(
      "interrupted index publication preserves source history",
      [KnowledgePublicationStage.Index],
      true,
    ),
  ],
};
