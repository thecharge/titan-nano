import { unit } from "@titan/test-factories";
import { requestCliAliasCases, requestCliCases } from "../cases/request-cli.ts";
import { requestCli } from "../factories/request-cli.ts";

unit(requestCli, requestCliCases);
unit(requestCli, requestCliAliasCases);
