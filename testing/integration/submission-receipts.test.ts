import { SdkProcessFixture } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  clientReceiptConfigCases,
  cliSubmissionReceiptCases,
  submissionReceiptCases,
} from "../cases/submission-receipts.ts";
import {
  clientReceiptConfig,
  cliSubmissionReceipt,
  cliSubmissionReceiptProcess,
  submissionReceipt,
} from "../factories/submission-receipts.ts";

unit(submissionReceipt, submissionReceiptCases);
unit(cliSubmissionReceipt, cliSubmissionReceiptCases, SdkProcessFixture.CaseTimeout);

unit(clientReceiptConfig, clientReceiptConfigCases);

unit(cliSubmissionReceiptProcess, cliSubmissionReceiptCases, SdkProcessFixture.CaseTimeout);
