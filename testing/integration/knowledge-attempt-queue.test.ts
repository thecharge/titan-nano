import { unit } from "@titan/test-factories";
import { knowledgeAttemptQueueCases } from "../cases/knowledge-attempt-queue.ts";
import { knowledgeAttemptQueue } from "../factories/knowledge-attempt-queue.ts";

unit(knowledgeAttemptQueue, knowledgeAttemptQueueCases);
