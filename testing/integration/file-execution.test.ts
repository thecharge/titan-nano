import { unit } from "@titan/test-factories";
import {
  fileExecutionBindingCases,
  fileExecutionSpecificationCases,
  fileExecutionValidationCases,
} from "../cases/file-execution.ts";
import {
  fileExecutionBinding,
  fileExecutionSpecification,
  fileExecutionValidation,
} from "../factories/file-execution.ts";

unit(fileExecutionBinding, fileExecutionBindingCases);
unit(fileExecutionSpecification, fileExecutionSpecificationCases);

unit(fileExecutionValidation, fileExecutionValidationCases);
