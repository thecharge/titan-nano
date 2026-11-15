import { unit } from "@titan/test-factories";
import { openCallIndependentCheckerCases, serverOpenCallProcessCases } from "../cases/open-call.ts";
import {
  openCallIndependentCheckerProcess,
  serverOpenCallProcess,
} from "../factories/open-call.ts";

unit(serverOpenCallProcess, serverOpenCallProcessCases);

unit(openCallIndependentCheckerProcess, openCallIndependentCheckerCases);
