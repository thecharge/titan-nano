import { unit } from "@titan/test-factories";
import {
  nativeAuthorityDrainCases,
  nativeAuthorityGuardsCases,
  nativeAuthorityLifecycleCases,
  nativeAuthorityQueuedCases,
  nativeFileServiceCases,
  nativeKnowledgeOwnershipCases,
  nativeKnowledgeReadOnlyCases,
} from "../cases/native-tools.ts";
import {
  nativeAuthorityDrain,
  nativeAuthorityGuards,
  nativeAuthorityLifecycle,
  nativeAuthorityQueued,
  nativeFileService,
  nativeKnowledgeOwnership,
  nativeKnowledgeReadOnly,
} from "../factories/native-tools.ts";

unit(nativeKnowledgeOwnership, nativeKnowledgeOwnershipCases);
unit(nativeKnowledgeReadOnly, nativeKnowledgeReadOnlyCases);
unit(nativeAuthorityLifecycle, nativeAuthorityLifecycleCases);
unit(nativeAuthorityDrain, nativeAuthorityDrainCases);
unit(nativeAuthorityGuards, nativeAuthorityGuardsCases);

unit(nativeAuthorityQueued, nativeAuthorityQueuedCases);
unit(nativeFileService, nativeFileServiceCases);
