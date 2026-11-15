import { unit } from "@titan/test-factories";
import {
  dependencyDirection,
  validPackageIdentity,
  vendorOwner,
} from "../../tooling/scripts/package-direction.ts";
import {
  dependencyDirectionCases,
  packageIdentityCases,
  vendorOwnerCases,
} from "../cases/package-direction.ts";

unit(dependencyDirection, dependencyDirectionCases);

unit(validPackageIdentity, packageIdentityCases);

unit(vendorOwner, vendorOwnerCases);
