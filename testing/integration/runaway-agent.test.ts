import { unit } from "@titan/test-factories";
import { runawayAgentCases } from "../cases/hive-limits.ts";
import { runawayAgent } from "../factories/hive-limits.ts";

unit(runawayAgent, runawayAgentCases);
