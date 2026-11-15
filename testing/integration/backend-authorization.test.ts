import { unit } from "@titan/test-factories";
import { backendAuthorizationCases } from "../cases/backend-authorization.ts";
import { backendAuthorization } from "../factories/backend-authorization.ts";

unit(backendAuthorization, backendAuthorizationCases);
