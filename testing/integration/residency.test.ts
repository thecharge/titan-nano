import { unit } from "@titan/test-factories";
import { residentOwnerCases } from "../cases/residency.ts";
import { residentOwner } from "../factories/residency.ts";

unit(residentOwner, residentOwnerCases);
