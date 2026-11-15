import { unit } from "@titan/test-factories";
import { vectorIndexCases } from "../cases/vector-index.ts";
import { vectorIndex } from "../factories/vector-index.ts";

unit(vectorIndex, vectorIndexCases);
