import { unit } from "@titan/test-factories";
import { engineRequestCases, operationRequestCases } from "../cases/requests.ts";
import { engineRequests, operationRequests } from "../factories/requests.ts";

unit(operationRequests, operationRequestCases);

unit(engineRequests, engineRequestCases);
