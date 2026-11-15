import { unit } from "@titan/test-factories";
import {
  hostBudgetCases,
  hostedIsolationCases,
  hostedNativeCases,
  hostedSharedCases,
  hostFailureCases,
  hostLeaseCases,
  hostPlatformCases,
  hostServiceCases,
  hostTransportCases,
  hostValueCases,
  nativeHostCompositionCases,
  nativeHostPortsCases,
} from "../cases/agent-host.ts";
import {
  hostBudget,
  hostedIsolation,
  hostedNative,
  hostedShared,
  hostFailure,
  hostLease,
  hostPlatform,
  hostService,
  hostTransport,
  hostValue,
  nativeHostComposition,
  nativeHostPorts,
} from "../factories/agent-host.ts";

unit(hostBudget, hostBudgetCases);
unit(hostFailure, hostFailureCases);
unit(hostService, hostServiceCases);
unit(hostLease, hostLeaseCases);
unit(nativeHostComposition, nativeHostCompositionCases);
unit(hostTransport, hostTransportCases);
unit(nativeHostPorts, nativeHostPortsCases);

unit(hostPlatform, hostPlatformCases);
unit(hostedNative, hostedNativeCases);

unit(hostedIsolation, hostedIsolationCases);

unit(hostedShared, hostedSharedCases);

unit(hostValue, hostValueCases);
