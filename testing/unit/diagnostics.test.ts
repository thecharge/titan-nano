import { unit } from "@titan/test-factories";
import { diagnosticCases } from "../cases/diagnostics.ts";
import { diagnostic } from "../factories/diagnostics.ts";

unit(diagnostic, diagnosticCases);
