import { unit } from "@titan/test-factories";
import {
  nativeBridgeCliCases,
  nativeBridgeEnvironmentCases,
  nativeBridgeFlowCases,
  nativeBridgeStartupCases,
  nativeHttpReadinessCases,
  nativeStdioLifecycleCases,
} from "../cases/native-tool-bridge.ts";
import {
  nativeBridgeCli,
  nativeBridgeEnvironment,
  nativeBridgeFlow,
  nativeBridgeStartup,
  nativeHttpReadiness,
  nativeStdioLifecycle,
} from "../factories/native-tool-bridge.ts";

unit(nativeBridgeEnvironment, nativeBridgeEnvironmentCases);
unit(nativeBridgeFlow, nativeBridgeFlowCases);
unit(nativeBridgeStartup, nativeBridgeStartupCases);

unit(nativeBridgeCli, nativeBridgeCliCases);

unit(nativeStdioLifecycle, nativeStdioLifecycleCases);

unit(nativeHttpReadiness, nativeHttpReadinessCases);
