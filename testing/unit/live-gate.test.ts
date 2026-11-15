import { LiveGroup } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { liveDecision, liveRun, liveTest } from "@titan/test-framework/live";
import { liveGateCases, liveRunCases } from "../cases/live-gate.ts";

unit(liveDecision, liveGateCases);
unit(liveRun, liveRunCases);
liveTest(
  LiveGroup.Runpod,
  ["RUNPOD_API_KEY"],
  "live gate registers without running",
  async () => {},
);
