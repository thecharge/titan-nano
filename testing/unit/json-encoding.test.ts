import { unit } from "@titan/test-factories";
import { jsonEncodingCases } from "../cases/json-encoding.ts";
import { encodedJson, measuredJson } from "../factories/json-encoding.ts";

unit(encodedJson, jsonEncodingCases);

unit(measuredJson, jsonEncodingCases);
