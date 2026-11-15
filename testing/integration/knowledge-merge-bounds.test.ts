import { unit } from "@titan/test-factories";
import { knowledgeMergeBoundsCases } from "../cases/knowledge-merge-bounds.ts";
import { knowledgeMergeBounds } from "../factories/knowledge-merge-bounds.ts";

unit(knowledgeMergeBounds, knowledgeMergeBoundsCases);
