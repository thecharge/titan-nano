import { unit } from "@titan/test-factories";
import {
  differentFilesCases,
  isolatedModeCases,
  liveCheckContinuationCases,
  liveConcurrentCases,
  liveOutsideCases,
  liveReadClaimCases,
  liveReconciliationCases,
  liveRecordCases,
  liveReviewCases,
  liveRollbackCases,
  liveSharedCases,
  liveWriteCases,
  putBackCases,
  sameFileCases,
} from "../cases/live-workspace.ts";
import {
  liveCheckContinuation,
  liveConcurrent,
  liveOverlap,
  liveRecord,
  liveRefute,
  liveReview,
  liveShared,
  liveWrite,
  putBackPaths,
} from "../factories/live-workspace.ts";

unit(liveWrite, liveWriteCases);

unit(liveReview, liveReviewCases);

unit(liveCheckContinuation, liveCheckContinuationCases);

unit(liveRecord, liveRecordCases);

unit(liveWrite, isolatedModeCases);

unit(liveRefute, liveRollbackCases);

unit(liveRefute, liveOutsideCases);

unit(liveOverlap, sameFileCases);

unit(liveOverlap, differentFilesCases);

unit(liveOverlap, liveReadClaimCases);

unit(putBackPaths, putBackCases);

unit(liveConcurrent, liveConcurrentCases);

unit(liveShared, liveSharedCases);

unit(liveConcurrent, liveReconciliationCases);
