export const SubmissionReceipt = {
  File: "submissions.db",
  Version: 1,
  Maximum: 10000,
} as const;
export const SubmissionReceiptSql = {
  Initialize: [
    "PRAGMA busy_timeout=1000",
    "PRAGMA synchronous=FULL",
    "CREATE TABLE IF NOT EXISTS receipts (client_id TEXT NOT NULL, submission_id TEXT NOT NULL, request_hash TEXT NOT NULL, schema_version INTEGER NOT NULL, PRIMARY KEY(client_id,submission_id))",
  ],
  Begin: "BEGIN IMMEDIATE",
  Commit: "COMMIT",
  Pair: "SELECT * FROM receipts WHERE client_id = ? AND submission_id = ?",
  Submission: "SELECT * FROM receipts WHERE submission_id = ? LIMIT 2",
  Count: "SELECT COUNT(*) AS count FROM receipts",
  Insert: "INSERT INTO receipts VALUES (?,?,?,?)",
} as const;
