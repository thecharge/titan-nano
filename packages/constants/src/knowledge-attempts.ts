import { KnowledgeLimit } from "./knowledge.ts";

export enum KnowledgeAttemptState {
  Open = "open",
  Prepared = "prepared",
  Published = "published",
  Discarded = "discarded",
}

export const KnowledgeAttemptFile = {
  Directory: "knowledge-pending",
  Extension: ".json",
} as const;

export const KnowledgeAttemptFormat = { Version: 1 } as const;
export const KnowledgeAttemptLimit = {
  Sets: 10000,
  DocumentBytes: KnowledgeLimit.PublicationBytes + KnowledgeLimit.ReceiptBytes + 1024,
} as const;

export const KnowledgeAttemptQueue = "knowledge-attempts";

export enum KnowledgeAttemptFixture {
  Intact = "intact",
  Reopen = "reopen",
  Malformed = "malformed",
  Scope = "scope",
  Receipt = "receipt",
  Digest = "digest",
  Metadata = "metadata",
  Linked = "linked",
  Shared = "shared",
  Directory = "directory",
}
