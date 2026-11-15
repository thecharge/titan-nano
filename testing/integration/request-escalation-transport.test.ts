import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { requestEscalationTransportCases } from "../cases/request-escalation-transport.ts";
import { requestEscalationTransport } from "../factories/request-escalation-transport.ts";

unit(
  requestEscalationTransport,
  requestEscalationTransportCases,
  undefined,
  TestSchedule.Concurrent,
);
