import { unit } from "@titan/test-factories";
import { claudeDenialCases } from "../cases/claude-denials.ts";
import { claudeDenials } from "../factories/claude-denials.ts";

unit(claudeDenials, claudeDenialCases);
