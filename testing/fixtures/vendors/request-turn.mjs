import { writeFile } from "node:fs/promises";
import { stateFile } from "./state.mjs";

export const requestTurnRole =
  "Transport contract role\nEnd each turn with result and requests. Complete work with result and an empty requests array. To wait for a decision, set result to null and provide requests with kind, scope and expires_at. A request records a question or permission decision; it does not execute or grant a tool. Continue only with the answers supplied by Titan.";

export function turnSchema(schema) {
  if (schema.required?.[0] !== "result") return schema;
  if (
    schema.required.join(",") !== "result,requests" ||
    schema.additionalProperties !== false ||
    schema.properties.requests?.type !== "array" ||
    schema.properties.requests.maxItems !== 256 ||
    schema.properties.requests.items?.additionalProperties !== false
  )
    throw new Error("Invalid request turn schema");
  const result = schema.properties.result?.anyOf?.find((entry) => entry.type !== "null");
  if (result?.type !== "object") throw new Error("Missing request turn result schema");
  return result;
}

export async function turnAnswer(schema, mode, native, prompt, cwd, normal) {
  if (
    typeof prompt === "string" &&
    prompt.startsWith("{") &&
    JSON.parse(prompt).task === "split_source"
  ) {
    if (turnSchema(schema).properties.parts?.type !== "array")
      throw new Error("Split source requires its declared array output");
    normal = { ...normal, parts: [1, 2] };
  }
  if (schema.required?.[0] !== "result") return normal;
  if (mode === "request_turn_helper") {
    if (native.turn === 1)
      return {
        result: null,
        requests: [
          {
            kind: "ask",
            scope: {
              operation: "ask",
              resource: "investigator",
              content_hashes: {},
              arguments: ["complete"],
              environment_names: [],
            },
            expires_at: Date.now() + 60000,
          },
        ],
      };
    const answers = JSON.parse(prompt).request_answers;
    if (
      answers?.length !== 1 ||
      answers[0]?.kind !== "ask" ||
      answers[0]?.answer?.decision !== "approve" ||
      JSON.parse(answers[0].answer.reason).ok !== true
    )
      throw new Error("Automatic helper answer did not reach the asking native session");
  }
  const web =
    typeof prompt === "string" &&
    prompt.startsWith("{") &&
    JSON.parse(prompt).task === "request_turn_web";
  const scope = {
    operation: web ? "web_read" : "read",
    resource: web ? "https://127.0.0.1/" : "reference",
    content_hashes: {},
    arguments: [],
    environment_names: [],
  };
  if ((mode === "request_turn" || mode === "request_turn_invalid") && native.turn === 1)
    return {
      result: mode === "request_turn_invalid" ? normal : null,
      requests: [
        {
          kind: "resource",
          scope,
          expires_at: Date.now() + 60000,
        },
      ],
    };
  if (mode === "request_turn") {
    await resumeGate(cwd, native.session_id);
    const input = JSON.parse(prompt);
    const answers = input.request_answers;
    if (
      !Array.isArray(answers) ||
      answers.length !== 1 ||
      answers[0]?.kind !== "resource" ||
      !["approve", "deny"].includes(answers[0]?.answer?.decision) ||
      answers[0]?.answer?.reason !== "Reviewed request turn"
    )
      throw new Error("Request answer did not reach its native session");
    await writeFile(
      await stateFile(cwd, "request-answers.json"),
      Buffer.from(JSON.stringify(answers)),
    );
  }
  return { result: normal, requests: [] };
}

async function resumeGate(cwd, session) {
  if (!(await Bun.file(await stateFile(cwd, "request-resume-hold")).exists())) return;
  await writeFile(await stateFile(cwd, "request-resume-entered"), Buffer.from(session));
  const release = await stateFile(cwd, "request-resume-release");
  for (let attempt = 0; attempt < 600; attempt++) {
    if (await Bun.file(release).exists()) return;
    await Bun.sleep(5);
  }
  throw new Error("Duplicate resume gate was not released");
}
