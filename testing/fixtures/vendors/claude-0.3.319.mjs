import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { activeTurn } from "./active.mjs";
import { deliver, deliveryTask } from "./delivery.mjs";
import { finalAttempt } from "./final-attempt.mjs";
import { nativeTask } from "./native-task.mjs";
import { requestTurnRole, turnAnswer, turnSchema } from "./request-turn.mjs";
import { stateFile } from "./state.mjs";

const args = process.argv.slice(2);
const value = (flag) =>
  args.find((entry) => entry.startsWith(`${flag}=`))?.slice(flag.length + 1) ??
  args[args.indexOf(flag) + 1];
if (
  value("--output-format") !== "stream-json" ||
  value("--input-format") !== "stream-json" ||
  !["", "Read", "Read,Write"].includes(value("--tools")) ||
  value("--permission-mode") !== "default" ||
  value("--setting-sources") !== "" ||
  !args.includes("--strict-mcp-config") ||
  value("--model") !== "stub-model" ||
  value("--max-turns") !== "3"
)
  throw new Error("Claude 0.3.319 request contract mismatch");
await using resources = new AsyncDisposableStack();
const configuration = args.some((arg) => arg.startsWith("--mcp-config"))
  ? JSON.parse(value("--mcp-config")).mcpServers
  : undefined;
if (configuration && (Object.keys(configuration).length !== 1 || !configuration.titan?.alwaysLoad))
  throw new Error("Invalid native MCP contract");
const nativeModule = configuration ? await import("./native-tools.mjs") : undefined;
const nativeTools = nativeModule
  ? await nativeModule.vendorNativeTools(configuration.titan, args, resources)
  : undefined;
const schema = JSON.parse(value("--json-schema"));
if (schema.type !== "object" || !["ok", "verdict", "result"].includes(schema.required?.[0]))
  throw new Error("Missing output schema");
const resultSchema = turnSchema(schema);
async function emit(event) {
  const bytes = Buffer.from(`${JSON.stringify(event)}\n`);
  process.stdout.write(bytes.subarray(0, 5));
  await Bun.sleep(1);
  process.stdout.write(bytes.subarray(5));
}
let initialized = false;
async function handleLine(line) {
  if (Buffer.byteLength(line) > 262144) throw new Error("Stub input exceeds contract limit");
  const message = JSON.parse(line);
  if (message.type === "control_request" && message.request.subtype === "initialize") {
    if (
      initialized ||
      message.request.systemPrompt?.[0] !==
        (schema.required?.[0] === "result" ? requestTurnRole : "Transport contract role") ||
      message.request.hooks?.PreToolUse?.[0]?.onFailure !== "block"
    )
      throw new Error("Invalid initialization contract");
    initialized = true;
    const initializedResponse = {
      commands: [],
      models: [],
      hook_on_failure_supported: true,
      hooks_applied: true,
    };
    const response = {
      subtype: "success",
      request_id: message.request_id,
      response: initializedResponse,
    };
    await emit({ type: "control_response", response });
    return false;
  }
  if (
    initialized &&
    message.type === "control_request" &&
    message.request.subtype === "mcp_status"
  ) {
    if (!nativeTools) throw new Error("Unexpected native status request");
    const response = {
      subtype: "success",
      request_id: message.request_id,
      response: { mcpServers: nativeTools.status },
    };
    await emit({ type: "control_response", response });
    return false;
  }
  if (!initialized || message.type !== "user") throw new Error("Unexpected SDK request");
  const content = message.message.content;
  const text =
    typeof content === "string"
      ? content
      : content?.length === 1 && content[0]?.type === "text"
        ? content[0].text
        : null;
  const task = typeof text === "string" && text.startsWith("{") ? JSON.parse(text).task : text;
  const delivery = deliveryTask(task);
  const final = finalAttempt(task, process.cwd(), Boolean(resultSchema.properties.verdict), text);
  let mode = final
    ? final.mode
    : delivery
      ? "delivery"
      : task === "delayed_recover_once"
        ? "recover_once"
        : await nativeTask(
            task,
            nativeTools,
            text,
            process.cwd(),
            !resultSchema.properties.verdict,
          );
  await appendFile(
    await stateFile(process.cwd(), "calls.jsonl"),
    `${JSON.stringify({ pid: process.pid, resume: args.some((entry) => entry.startsWith("--resume=")) })}\n`,
  );
  await appendFile(
    await stateFile(
      process.cwd(),
      `${resultSchema.properties.verdict ? "checker" : "worker"}-calls.jsonl`,
    ),
    `${JSON.stringify({ pid: process.pid, resume: args.some((entry) => entry.startsWith("--resume=")) })}\n`,
  );
  if (
    ![
      "rate_warning",
      "rate_rejected_notice",
      "rate_limit_once",
      "rate_wait_once",
      "service_retry_once",
      "server_retry_once",
      "rate_limit_always",
      "unknown_retry",
      "invalid_retry",
      "billing_retry",
      "quota_exhausted",
      "quota_billing",
      "mismatched_retry",
      "complete",
      "request_turn",
      "request_turn_helper",
      "request_turn_invalid",
      "replaced_session",
      "replaced_result",
      "recover_replaced_session",
      "recover_replaced_result",
      "truncated",
      "malformed",
      "exit",
      "cancel",
      "await_peer",
      "recover_once",
      "active_once",
      "delivery",
    ].includes(mode)
  )
    throw new Error(`Unscripted Claude request: ${mode}`);
  const resume = args.some((entry) => entry.startsWith("--resume="));
  const nativeId = resume ? value("--resume") : `stub-${process.pid}`;
  const nativeFile = await stateFile(
    process.cwd(),
    `native-session-${Buffer.from(nativeId).toString("base64url")}.json`,
  );
  const native = resume
    ? JSON.parse(await readFile(nativeFile, "utf8"))
    : { session_id: nativeId, turn: 0 };
  if (resume && value("--resume") !== native.session_id)
    throw new Error("Native session unavailable");
  native.turn++;
  if (mode === "recover_replaced_session")
    mode = native.turn === 1 ? "recover_once" : "replaced_session";
  if (mode === "recover_replaced_result")
    mode = native.turn === 1 ? "recover_once" : "replaced_result";
  await writeFile(nativeFile, JSON.stringify(native));
  await emit({
    type: "system",
    subtype: "init",
    session_id: mode === "replaced_session" ? "replacement-session" : native.session_id,
  });
  await nativeModule?.claudeNativeEvents(nativeTools, native.session_id, emit);
  if (["quota_exhausted", "quota_billing"].includes(mode)) {
    const message = {
      id: `credits-${process.pid}`,
      type: "message",
      role: "assistant",
      model: "stub-model",
      content: [{ type: "text", text: "Synthetic exhausted credit allowance" }],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
    await emit({
      type: "assistant",
      session_id: native.session_id,
      uuid: `credits-${process.pid}`,
      parent_tool_use_id: null,
      error: mode === "quota_exhausted" ? "rate_limit" : "billing_error",
      errorCode: "credits_required",
      message,
    });
    return true;
  }
  if (["rate_warning", "rate_rejected_notice"].includes(mode))
    await emit({
      type: "rate_limit_event",
      rate_limit_info: { status: mode === "rate_warning" ? "allowed_warning" : "rejected" },
      uuid: `limit-${process.pid}`,
      session_id: native.session_id,
    });
  if (
    mode === "rate_limit_always" ||
    ["unknown_retry", "invalid_retry", "billing_retry", "mismatched_retry"].includes(mode) ||
    (native.turn === 1 &&
      ["rate_limit_once", "rate_wait_once", "service_retry_once", "server_retry_once"].includes(
        mode,
      ))
  ) {
    if (mode === "rate_wait_once" && value("--tools").includes("Write"))
      await writeFile(
        join(process.cwd(), "PARTIAL.txt"),
        Buffer.from("Work retained before retry\n"),
      );
    await emit({
      type: "system",
      subtype: "api_retry",
      attempt: 1,
      max_retries: 10,
      retry_delay_ms: mode === "rate_wait_once" ? 60000 : mode === "invalid_retry" ? -1 : 1,
      error_status:
        mode === "unknown_retry"
          ? null
          : mode === "service_retry_once"
            ? 503
            : mode === "server_retry_once"
              ? 500
              : mode === "billing_retry" || mode === "mismatched_retry"
                ? 403
                : 429,
      error:
        mode === "unknown_retry"
          ? "unknown"
          : mode === "service_retry_once"
            ? "overloaded"
            : mode === "server_retry_once"
              ? "server_error"
              : mode === "billing_retry"
                ? "billing_error"
                : "rate_limit",
      uuid: `retry-${process.pid}-${native.turn}`,
      session_id: native.session_id,
    });
    return true;
  }
  if (mode === "await_peer") {
    const gate = await stateFile(process.cwd(), "peer-cancelled");
    for (let attempt = 0; attempt < 300 && !(await Bun.file(gate).exists()); attempt++)
      await Bun.sleep(5);
    if (!(await Bun.file(gate).exists())) throw new Error("Peer cancellation was not observed");
  }
  if (task === "delayed_recover_once" && native.turn === 1) await Bun.sleep(1250);
  if (mode === "active_once") await activeTurn(process.cwd(), native.turn);
  if (mode === "cancel") await Bun.sleep(30000);
  else if (mode === "malformed") process.stdout.write("{broken\n");
  else if (mode === "exit") process.exitCode = 7;
  else if (mode !== "truncated" && !(mode === "recover_once" && native.turn === 1)) {
    if (delivery) await deliver(delivery, process.cwd(), Boolean(resultSchema.properties.verdict));
    else if (
      resultSchema.properties.verdict &&
      mode === "recover_once" &&
      (await readFile(join(process.cwd(), "DELIVERED.txt"), "utf8")) !== "Delivered by SDK stub"
    )
      throw new Error("Candidate file changed");
    else if (!resultSchema.properties.verdict && value("--tools").includes("Write"))
      await writeFile(join(process.cwd(), "DELIVERED.txt"), "Delivered by SDK stub");
    const modelUsage = { stub: { inputTokens: native.turn * 4, outputTokens: native.turn * 2 } };
    await emit({
      type: "result",
      subtype: "success",
      session_id: mode === "replaced_result" ? "replacement-session" : native.session_id,
      is_error: false,
      result: "done",
      structured_output: await turnAnswer(
        schema,
        mode,
        native,
        text,
        process.cwd(),
        final?.verdict ??
          (resultSchema.properties.verdict
            ? {
                verdict: task === "native_project_refused" ? "refuted" : "survived",
                evidence: "Checked preserved candidate",
              }
            : { ok: true, marker: process.cwd(), turn: native.turn }),
      ),
      modelUsage,
      total_cost_usd: 0,
      permission_denials: [],
      num_turns: 1,
    });
  }
  return true;
}

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (await handleLine(line)) break;
}

process.stdin.destroy();
