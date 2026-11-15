import { unit } from "@titan/test-factories";
import { knowledgeHttpCases } from "../cases/knowledge-http.ts";
import { knowledgeHttp } from "../factories/knowledge-http.ts";

unit(knowledgeHttp, knowledgeHttpCases);
