import { unit } from "@titan/test-factories";
import { requestEscalationClientCases } from "../cases/request-escalation-client.ts";
import { requestEscalationClient } from "../factories/request-escalation-client.ts";

unit(requestEscalationClient, requestEscalationClientCases);
