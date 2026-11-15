import { unit } from "@titan/test-factories";
import { embedderChangedCases } from "../cases/embedder-changed.ts";
import { embedderChanged } from "../factories/embedder-changed.ts";

unit(embedderChanged, embedderChangedCases);
