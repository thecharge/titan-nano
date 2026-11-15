import { unit } from "@titan/test-factories";
import { sameVectorCases } from "../cases/embedder-fake.ts";
import { sameVector } from "../factories/embedder-fake.ts";

unit(sameVector, sameVectorCases);
