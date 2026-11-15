import { unit } from "@titan/test-factories";
import {
  knowledgeMaintenanceCases,
  knowledgeMaintenanceRecoveryCases,
  knowledgeMaintenanceSurfaceCases,
} from "../cases/knowledge-maintenance.ts";
import {
  knowledgeMaintenance,
  knowledgeMaintenanceRecovery,
  knowledgeMaintenanceSurface,
} from "../factories/knowledge-maintenance.ts";

unit(knowledgeMaintenance, knowledgeMaintenanceCases);
unit(knowledgeMaintenanceSurface, knowledgeMaintenanceSurfaceCases);
unit(knowledgeMaintenanceRecovery, knowledgeMaintenanceRecoveryCases);
