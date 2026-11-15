import { unit } from "@titan/test-factories";
import { requestClientCases } from "../cases/request-client.ts";
import { requestClientResponse } from "../factories/request-client.ts";

unit(requestClientResponse, requestClientCases);
