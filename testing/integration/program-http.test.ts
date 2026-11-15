import { unit } from "@titan/test-factories";
import { programHttpCases } from "../cases/program-api.ts";
import { programHttp } from "../factories/program-api.ts";

unit(programHttp, programHttpCases);
