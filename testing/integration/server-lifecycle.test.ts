import { unit } from "@titan/test-factories";
import {
  serverAdmissionCases,
  serverLifecycleCases,
  serverShutdownCases,
} from "../cases/server-lifecycle.ts";
import { serverAdmission, serverLifecycle, serverShutdown } from "../factories/server-lifecycle.ts";

unit(serverLifecycle, serverLifecycleCases);

unit(serverAdmission, serverAdmissionCases);
unit(serverShutdown, serverShutdownCases);
