import { unit } from "@titan/test-factories";
import {
  daemonRuntimeHandoffCases,
  runtimeBuildServerCases,
  runtimeDefaultConnectionCases,
  runtimeHandoffCases,
  runtimeMcpRecoveryCases,
  runtimeRecoveryCases,
  runtimeTransportRecoveryCases,
} from "../cases/runtime-recovery.ts";
import {
  daemonRuntimeHandoff,
  runtimeBuildServer,
  runtimeDefaultConnection,
  runtimeHandoff,
  runtimeMcpRecovery,
  runtimeRecovery,
  runtimeTransportRecovery,
} from "../factories/runtime-recovery.ts";

unit(runtimeRecovery, runtimeRecoveryCases);
unit(runtimeHandoff, runtimeHandoffCases);
unit(daemonRuntimeHandoff, daemonRuntimeHandoffCases);
unit(runtimeTransportRecovery, runtimeTransportRecoveryCases);
unit(runtimeMcpRecovery, runtimeMcpRecoveryCases);
unit(runtimeDefaultConnection, runtimeDefaultConnectionCases);

unit(runtimeBuildServer, runtimeBuildServerCases);
