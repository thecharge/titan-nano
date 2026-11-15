import { unit } from "@titan/test-factories";
import { daemonMaintenanceCases, serverMaintenanceCases } from "../cases/server-maintenance.ts";
import { daemonMaintenance, serverMaintenance } from "../factories/server-maintenance.ts";

unit(serverMaintenance, serverMaintenanceCases);

unit(daemonMaintenance, daemonMaintenanceCases);
