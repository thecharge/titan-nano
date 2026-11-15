import { unit } from "@titan/test-factories";
import { dashboardCommandCases } from "../cases/dashboard-command.ts";
import { dashboardCommand } from "../factories/dashboard-command.ts";

unit(dashboardCommand, dashboardCommandCases);
