import { unit } from "@titan/test-factories";
import {
  serverSubmissionCases,
  workflowSourceSubmissionCases,
} from "../cases/server-submission.ts";
import {
  submissionCaptureRetryCases,
  submissionProjectCases,
} from "../cases/submission-capture-retry.ts";
import { serverSubmission, workflowSourceSubmission } from "../factories/server-submission.ts";
import {
  submissionCaptureRetry,
  submissionProject,
} from "../factories/submission-capture-retry.ts";

unit(serverSubmission, serverSubmissionCases);

unit(workflowSourceSubmission, workflowSourceSubmissionCases);
unit(submissionCaptureRetry, submissionCaptureRetryCases);
unit(submissionProject, submissionProjectCases);
