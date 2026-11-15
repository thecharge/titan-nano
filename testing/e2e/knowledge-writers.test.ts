import { KnowledgeWriterFixture } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { knowledgeWriterCases } from "../cases/knowledge-writers.ts";
import { knowledgeWriters } from "../factories/knowledge-writers.ts";

unit(knowledgeWriters, knowledgeWriterCases, KnowledgeWriterFixture.TimeoutMilliseconds);
