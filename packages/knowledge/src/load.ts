import { KnowledgeLimit } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { parseKnowledgeFile } from "./format.ts";

export async function loadKnowledge(path: string) {
  return parseKnowledgeFile(
    await readFileBytes(path, KnowledgeLimit.EntryBytes),
    KnowledgeLimit.EntryBytes,
  );
}
