import { merge, object, parseData } from "@titan/config";
import { unit } from "@titan/test-factories";
import { mergeCases, objectCases, yamlCases } from "../cases/config.ts";

unit(object, objectCases);
unit(merge, mergeCases);
unit(parseData, yamlCases);
