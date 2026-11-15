import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { dashboardCookieCases } from "../cases/dashboard-cookie.ts";
import { dashboardCookie } from "../factories/server-startup.ts";

unit(dashboardCookie, dashboardCookieCases, undefined, TestSchedule.Concurrent);
