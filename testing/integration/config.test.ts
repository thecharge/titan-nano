import { unit } from "@titan/test-factories";
import {
  agentHostConfigCases,
  backendLaunchCases,
  cliConfigInspectionCases,
  fileConfigCases,
  nativeTransportConfigCases,
} from "../cases/config.ts";
import {
  cliConfigInspection,
  configuredAgentHost,
  configuredBackendLaunch,
  configuredNativeTransport,
  configuredParallelism,
} from "../factories/config.ts";

unit(configuredParallelism, fileConfigCases);
unit(cliConfigInspection, cliConfigInspectionCases);

unit(configuredBackendLaunch, backendLaunchCases);

unit(configuredAgentHost, agentHostConfigCases);

unit(configuredNativeTransport, nativeTransportConfigCases);
