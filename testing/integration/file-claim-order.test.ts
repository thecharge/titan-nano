import { unit } from "@titan/test-factories";
import {
  fileClaimBindingCases,
  fileClaimCapacityCases,
  fileClaimOrderingCases,
  reconciliationClaimCases,
} from "../cases/file-claim-order.ts";
import {
  fileClaimBinding,
  fileClaimCapacity,
  fileClaimOrdering,
  reconciliationClaim,
} from "../factories/file-claim-order.ts";

unit(fileClaimOrdering, fileClaimOrderingCases);
unit(fileClaimBinding, fileClaimBindingCases);
unit(fileClaimCapacity, fileClaimCapacityCases);
unit(reconciliationClaim, reconciliationClaimCases);
