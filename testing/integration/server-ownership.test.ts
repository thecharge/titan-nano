import { unit } from "@titan/test-factories";
import {
  leasePathSafetyCases,
  maintenanceOwnershipCases,
  maintenanceProcessCases,
  serverOwnershipCases,
} from "../cases/server-ownership.ts";
import {
  leasePathSafety,
  maintenanceOwnership,
  maintenanceProcess,
  serverOwnership,
} from "../factories/server-ownership.ts";

unit(serverOwnership, serverOwnershipCases);

unit(maintenanceOwnership, maintenanceOwnershipCases);

unit(maintenanceProcess, maintenanceProcessCases);

unit(leasePathSafety, leasePathSafetyCases);
