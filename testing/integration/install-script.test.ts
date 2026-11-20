import { unit } from "@titan/test-factories";
import {
  installBootstrapCases,
  installScriptCases,
  managedLifecycleCases,
} from "../cases/install-script.ts";
import { installBootstrap, managedLifecycle, startScript } from "../factories/install-script.ts";

unit(startScript, installScriptCases);
unit(installBootstrap, installBootstrapCases);
unit(managedLifecycle, managedLifecycleCases);
