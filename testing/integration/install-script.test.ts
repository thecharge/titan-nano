import { unit } from "@titan/test-factories";
import { installBootstrapCases, installScriptCases } from "../cases/install-script.ts";
import { installBootstrap, startScript } from "../factories/install-script.ts";

unit(startScript, installScriptCases);
unit(installBootstrap, installBootstrapCases);
