import { unit } from "@titan/test-factories";
import { requestTransportCases } from "../cases/request-transport.ts";
import { requestTransport } from "../factories/request-transport.ts";

unit(requestTransport, requestTransportCases);
