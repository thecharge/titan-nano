import { unit } from "@titan/test-factories";
import { persistedDashboardCases } from "../cases/dashboard-persisted.ts";
import { persistedDashboard } from "../factories/dashboard-persisted.ts";

unit(persistedDashboard, persistedDashboardCases);
