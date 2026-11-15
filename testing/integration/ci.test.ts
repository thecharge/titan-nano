import { unit } from "@titan/test-factories";
import { ciTestFailureCases } from "../cases/ci.ts";
import { ciTestFailure } from "../factories/ci.ts";

unit(ciTestFailure, ciTestFailureCases);
