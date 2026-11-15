import { unit } from "@titan/test-factories";
import { mcpSubmissionCases, mcpSubmissionResponseCases } from "../cases/mcp-submission.ts";
import {
  mcpSubmission,
  mcpSubmissionProcess,
  mcpSubmissionResponse,
} from "../factories/mcp-submission.ts";

unit(mcpSubmission, mcpSubmissionCases);
unit(mcpSubmissionResponse, mcpSubmissionResponseCases);

unit(mcpSubmissionProcess, mcpSubmissionCases);
