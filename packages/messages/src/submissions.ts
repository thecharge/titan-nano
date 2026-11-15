export const SubmissionReceiptMessage = {
  Invalid: "Submission receipt is invalid",
  Unavailable: "Submission receipt could not be committed; no submission was sent",
  Ambiguous: "Submission id belongs to several clients; supply --client-id",
  Conflict: "Submission receipt belongs to different input; use a new submission id for new work",
  Full: "Submission receipt allowance is full; retain saved identities and review client.max_submission_receipts",
  Owner: "Client receipt settings belong to the home owner",
} as const;
export const uncertainSubmission = (client: string, submission: string, path: string): string =>
  `Submission response is uncertain. Retry the same workflow and settings using --client-id and --submission-id from this receipt. Client ${JSON.stringify(client)}, submission ${JSON.stringify(submission)}. Receipt ledger ${JSON.stringify(path)}`;
