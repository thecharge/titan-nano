import { unit } from "@titan/test-factories";
import { emptyAlarmCases, serialAlarmCases } from "../cases/policy-alarms.ts";
import { emptyAlarm, serialAlarm } from "../factories/policy-alarms.ts";

unit(serialAlarm, serialAlarmCases);
unit(emptyAlarm, emptyAlarmCases);
