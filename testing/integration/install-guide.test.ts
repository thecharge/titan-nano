import { unit } from "@titan/test-factories";
import { installGuideCases } from "../cases/install-guide.ts";
import { installGuideCommands } from "../factories/install-guide.ts";

unit(installGuideCommands, installGuideCases);
