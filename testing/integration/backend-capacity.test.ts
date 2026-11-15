import { unit } from "@titan/test-factories";
import {
  backendCapacityAdmissionCases,
  backendCapacityRunCases,
  backendCapacityServerCases,
  capacityQueuedBackendCases,
  capacityRunCeilingCases,
  configuredBackendCapacityCases,
} from "../cases/backend-capacity.ts";
import {
  backendCapacityAdmission,
  backendCapacityRun,
  capacityQueuedBackend,
  capacityRunCeiling,
} from "../factories/backend-capacity.ts";
import {
  backendCapacityServer,
  configuredBackendCapacity,
} from "../factories/backend-capacity-server.ts";

unit(backendCapacityAdmission, backendCapacityAdmissionCases);
unit(backendCapacityRun, backendCapacityRunCases);
unit(configuredBackendCapacity, configuredBackendCapacityCases);
unit(backendCapacityServer, backendCapacityServerCases);
unit(capacityRunCeiling, capacityRunCeilingCases);
unit(capacityQueuedBackend, capacityQueuedBackendCases);
