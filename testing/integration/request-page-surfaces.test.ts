import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { requestPageSurfaceCases } from "../cases/request-page-surfaces.ts";
import { requestPageSurface } from "../factories/request-page-surfaces.ts";

unit(requestPageSurface, requestPageSurfaceCases, undefined, TestSchedule.Concurrent);
