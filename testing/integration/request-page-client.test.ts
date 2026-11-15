import { unit } from "@titan/test-factories";
import { requestPageClientCases } from "../cases/request-page-client.ts";
import { requestPageClient } from "../factories/request-page-client.ts";

unit(requestPageClient, requestPageClientCases);
