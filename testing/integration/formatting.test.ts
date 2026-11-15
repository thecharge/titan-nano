import { unit } from "@titan/test-factories";
import { documentationAdmissionCases, documentationFormattingCases } from "../cases/formatting.ts";
import { documentationAdmission, documentationFormatting } from "../factories/formatting.ts";

unit(documentationFormatting, documentationFormattingCases);
unit(documentationAdmission, documentationAdmissionCases);
