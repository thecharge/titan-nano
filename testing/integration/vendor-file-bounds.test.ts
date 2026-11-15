import { unit } from "@titan/test-factories";
import { vendorFileBoundCases } from "../cases/vendor-file-bounds.ts";
import { claudeFixtureBytes } from "../factories/claude-transport.ts";
import { codexFixtureBytes } from "../factories/codex-transport.ts";

unit(codexFixtureBytes, vendorFileBoundCases);
unit(claudeFixtureBytes, vendorFileBoundCases);
