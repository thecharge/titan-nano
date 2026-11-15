import { unit } from "@titan/test-factories";
import { dashboardApiCases } from "../cases/dashboard-api.ts";
import { dashboardApi } from "../factories/server-startup.ts";

unit(dashboardApi, dashboardApiCases);
