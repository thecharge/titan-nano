import { unit } from "@titan/test-factories";
import { scopedPromoteCases } from "../cases/knowledge-promote.ts";
import { scopedPromote } from "../factories/knowledge-promote.ts";

unit(scopedPromote, scopedPromoteCases);
