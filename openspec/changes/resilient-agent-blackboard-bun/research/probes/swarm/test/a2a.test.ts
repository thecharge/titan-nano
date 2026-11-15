// Probe: an A2A Agent Card for `titan serve`, built with the types of
// @a2a-js/sdk 1.3.0 and read back with its own JSON functions. No server, no network.
import { expect, test } from "bun:test";
import { A2A_PROTOCOL_VERSION, AGENT_CARD_PATH, AgentCard } from "@a2a-js/sdk";

test("titan serve agent card round-trips through the SDK's JSON functions", () => {
  const card: AgentCard = {
    name: "titan",
    description: "Runs a hive of personas on one board, with a falsifier for each step.",
    supportedInterfaces: [{ url: "http://127.0.0.1:7777/a2a", protocolBinding: "JSONRPC", tenant: "", protocolVersion: A2A_PROTOCOL_VERSION }],
    provider: undefined,
    version: "0.1.0",
    capabilities: { streaming: true, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [
      {
        id: "run-workflow",
        name: "Run a workflow",
        description: "Runs a titan workflow file and returns the run record.",
        tags: ["workflow"],
        examples: ["run examples/fix-bug.yaml"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        securityRequirements: [],
      },
    ],
    signatures: [],
  };
  const json = AgentCard.toJSON(card);
  const back = AgentCard.fromJSON(json);
  console.log("card path:", AGENT_CARD_PATH, "| protocol:", A2A_PROTOCOL_VERSION);
  console.log(JSON.stringify(json, null, 1).slice(0, 600));
  expect(back.name).toBe("titan");
  expect(back.skills[0]?.id).toBe("run-workflow");
  expect(AGENT_CARD_PATH).toBe(".well-known/agent-card.json");
});
