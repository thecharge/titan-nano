import { unit } from "@titan/test-factories";
import {
  hostReadinessCases,
  serviceReadinessCases,
  standaloneReadinessCases,
} from "../cases/host-readiness.ts";
import {
  hostReadiness,
  serviceReadiness,
  standaloneReadiness,
} from "../factories/host-readiness.ts";

unit(hostReadiness, hostReadinessCases);
unit(standaloneReadiness, standaloneReadinessCases);

unit(serviceReadiness, serviceReadinessCases);
