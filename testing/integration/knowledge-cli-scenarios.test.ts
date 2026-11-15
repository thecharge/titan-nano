import { unit } from "@titan/test-factories";
import { knowledgeCliScenarioCases } from "../cases/knowledge-cli-scenarios.ts";
import { knowledgeCliScenario } from "../factories/knowledge-cli-scenarios.ts";

unit(knowledgeCliScenario, knowledgeCliScenarioCases);
