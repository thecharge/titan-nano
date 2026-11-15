import { unit } from "@titan/test-factories";
import {
  usageHttpRouteCases,
  usageResponseCases,
  usageTransportCases,
} from "../cases/usage-transport.ts";
import { usageHttpRoute, usageResponse, usageTransport } from "../factories/usage-transport.ts";

unit(usageTransport, usageTransportCases);
unit(usageResponse, usageResponseCases);
unit(usageHttpRoute, usageHttpRouteCases);
