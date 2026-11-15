import { unit } from "@titan/test-factories";
import { localEmbedderCases } from "../cases/embedder-local.ts";
import { localEmbedding } from "../factories/embedder-local.ts";

unit(localEmbedding, localEmbedderCases);
