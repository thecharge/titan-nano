import { unit } from "@titan/test-factories";
import {
  fileClaimBindingCases,
  fileClaimCapacityCases,
  fileClaimOrderingCases,
  fileReaderPrecedenceCases,
  reconciliationClaimCases,
} from "../cases/file-claim-order.ts";
import {
  fileClaimBinding,
  fileClaimCapacity,
  fileClaimOrdering,
  fileReaderPrecedence,
  reconciliationClaim,
} from "../factories/file-claim-order.ts";

unit(fileClaimOrdering, fileClaimOrderingCases);
unit(fileClaimBinding, fileClaimBindingCases);
unit(fileClaimCapacity, fileClaimCapacityCases);
unit(reconciliationClaim, reconciliationClaimCases);

unit(fileReaderPrecedence, fileReaderPrecedenceCases);
