import { unit } from "@titan/test-factories";
import {
  binaryContainmentCases,
  graphManifestCases,
  guardedProcessCases,
  hookFailureCases,
  hookProcessCases,
  loadedPolicyCases,
  messageCommandCases,
} from "../cases/tool-guards.ts";
import {
  binaryContainment,
  graphManifest,
  guardedProcess,
  hookFailure,
  hookProcess,
  loadedPolicy,
  messageCommand,
} from "../factories/tool-guards.ts";

unit(loadedPolicy, loadedPolicyCases);
unit(messageCommand, messageCommandCases);
unit(hookFailure, hookFailureCases);
unit(hookProcess, hookProcessCases);
unit(guardedProcess, guardedProcessCases);
unit(binaryContainment, binaryContainmentCases);
unit(graphManifest, graphManifestCases);
