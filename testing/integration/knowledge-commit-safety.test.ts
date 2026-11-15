import { unit } from "@titan/test-factories";
import {
  knowledgeCommitReceiptBoundaryCases,
  knowledgeCommitSnapshotCases,
  knowledgeCommitVersionCases,
  knowledgePublicationSettingsCases,
} from "../cases/knowledge-commit-safety.ts";
import {
  knowledgeCommitReceiptBoundary,
  knowledgeCommitSnapshot,
  knowledgeCommitVersion,
  knowledgePublicationSettings,
} from "../factories/knowledge-commit-safety.ts";

unit(knowledgePublicationSettings, knowledgePublicationSettingsCases);
unit(knowledgeCommitVersion, knowledgeCommitVersionCases);
unit(knowledgeCommitReceiptBoundary, knowledgeCommitReceiptBoundaryCases);
unit(knowledgeCommitSnapshot, knowledgeCommitSnapshotCases);
