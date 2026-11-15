import { unit } from "@titan/test-factories";
import {
  nativeProjectKnowledgeCases,
  nativeProjectLegacyCases,
} from "../cases/native-project-knowledge.ts";
import {
  nativeProjectKnowledge,
  nativeProjectLegacy,
} from "../factories/native-project-knowledge.ts";

unit(nativeProjectKnowledge, nativeProjectKnowledgeCases);
unit(nativeProjectLegacy, nativeProjectLegacyCases);
