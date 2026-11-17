#!/usr/bin/env bun

import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { activeTurn } from "./active.mjs";
import { deliver, deliveryTask } from "./delivery.mjs";
import { nativeTask } from "./native-task.mjs";
import { turnAnswer, turnSchema } from "./request-turn.mjs";
import { stateFile } from "./state.mjs";

const args = process.argv.slice(2);
await using resources = new AsyncDisposableStack();
const nativeModule = args.some((arg) => arg.startsWith("mcp_servers.titan."))
  ? await import("./native-tools.mjs")
  : undefined;
const nativeTools = nativeModule
  ? await nativeModule.vendorNativeTools(
      nativeModule.codexNativeConfiguration(args),
      args,
      resources,
    )
  : undefined;
const value = (flag) => args[args.indexOf(flag) + 1];
const cwd = value("--cd");
const scoped = args.includes('default_permissions="titan-scoped"');
let scopedPaths;
if (scoped) {
  if (
    args.includes("--sandbox") ||
    !args.includes("permissions.titan-scoped.network.enabled=false")
  )
    throw new Error("Invalid scoped sandbox contract");
  const setting = args.find((arg) => arg.startsWith("permissions.titan-scoped.filesystem="));
  if (!setting) throw new Error("Missing scoped filesystem contract");
  const permissions = Bun.TOML.parse(setting).permissions["titan-scoped"].filesystem;
  scopedPaths = permissions[":workspace_roots"];
  if (permissions[":root"] !== "read" || permissions[":workspace_roots"]?.["."] !== "read")
    throw new Error("Scoped root must be read-only");
  for (const [path, mode] of Object.entries(permissions[":workspace_roots"])) {
    if (path === ".") continue;
    if (mode !== "write" || path.startsWith("/") || path.split("/").includes(".."))
      throw new Error("Invalid scoped write contract");
  }
}
let prompt = Buffer.alloc(0);
for await (const chunk of process.stdin) {
  prompt = Buffer.concat([prompt, chunk]);
  if (prompt.length > 262144) throw new Error("Stub input exceeds contract limit");
}
const raw = prompt.toString().split("\n").at(-1);
const writePolicy =
  "Project writes must stay within the declared file scope. Use titan_file_read to obtain a version and titan_file_write with that expected_version to create or replace a file when a native editor is refused. Use null only for a missing file. A changed version requires a fresh read and reconciliation. Shell commands cannot create, rename or remove project files.";
const role = prompt.toString().slice(0, prompt.toString().lastIndexOf("\n\n"));
const task = raw?.startsWith("{") ? JSON.parse(raw).task : raw;
const schema = JSON.parse(await readFile(value("--output-schema"), "utf8"));
if (schema.type !== "object" || !["ok", "verdict", "result"].includes(schema.required?.[0]))
  throw new Error("Missing output schema");
const resultSchema = turnSchema(schema);
const writable =
  value("--sandbox") === "workspace-write" || (scoped && !resultSchema.properties.verdict);
if (task === "native_file_write" || task === "native_file_write_refused") {
  const expected = { ".": "read" };
  if (task === "native_file_write" && role.endsWith(writePolicy)) {
    expected["source.txt"] = "write";
    for (const metadata of [".git", ".agents", ".codex", ".aws"])
      expected[`source.txt/${metadata}`] = "write";
  }
  if (JSON.stringify(scopedPaths) !== JSON.stringify(expected))
    throw new Error("Declared file scope changed in the pinned SDK launch");
}
const delivery = deliveryTask(task);
let mode = delivery
  ? "delivery"
  : task === "delayed_recover_once"
    ? "recover_once"
    : await nativeTask(task, nativeTools, raw, cwd, writable);
const resume = args.includes("resume");
await appendFile(
  await stateFile(cwd, "calls.jsonl"),
  `${JSON.stringify({ pid: process.pid, resume })}\n`,
);
if (
  args[0] !== "exec" ||
  args[1] !== "--experimental-json" ||
  !args.includes("--ignore-user-config") ||
  (!scoped && !["read-only", "workspace-write"].includes(value("--sandbox"))) ||
  value("--model") !== "stub-model" ||
  !args.includes('approval_policy="never"') ||
  !args.includes("sandbox_workspace_write.network_access=false") ||
  !args.includes('web_search="disabled"') ||
  !args.includes("features.apps=false") ||
  !args.includes("features.plugins=false") ||
  !args.includes("features.remote_plugin=false") ||
  !args.includes("features.hooks=false") ||
  !args.includes(`developer_instructions=${JSON.stringify(role)}`) ||
  !prompt.toString().startsWith("Transport contract role")
)
  throw new Error("Codex 0.167.0 request contract mismatch");
if (role.includes("Skill linked:")) {
  if (!nativeTools) throw new Error("Missing skill reference binding");
  await nativeTools.verifySkills(role);
}
await appendFile(
  await stateFile(cwd, `${resultSchema.properties.verdict ? "checker" : "worker"}-calls.jsonl`),
  `${JSON.stringify({ pid: process.pid, resume })}\n`,
);
if (
  ![
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
    "invalid_output",
    "exit",
    "cancel",
    "await_peer",
    "recover_once",
    "active_once",
    "delivery",
  ].includes(mode)
)
  throw new Error(`Unscripted Codex request: ${mode}`);
async function emit(event) {
  const bytes = Buffer.from(`${JSON.stringify(event)}\n`);
  process.stdout.write(bytes.subarray(0, 5));
  await Bun.sleep(1);
  process.stdout.write(bytes.subarray(5));
}
const nativeId = resume ? value("resume") : `stub-${process.pid}`;
const nativeFile = await stateFile(
  cwd,
  `native-session-${Buffer.from(nativeId).toString("base64url")}.json`,
);
const native = resume
  ? JSON.parse(await readFile(nativeFile, "utf8"))
  : { session_id: nativeId, turn: 0 };
if (resume && value("resume") !== native.session_id) throw new Error("Native session unavailable");
native.turn++;
if (mode === "recover_replaced_session")
  mode = native.turn === 1 ? "recover_once" : "replaced_session";
if (mode === "recover_replaced_result")
  mode = native.turn === 1 ? "recover_once" : "replaced_result";
await writeFile(nativeFile, JSON.stringify(native));
if (mode === "replaced_session")
  await emit({ type: "thread.started", thread_id: "replacement-session" });
else if (!resume || mode === "replaced_result")
  await emit({ type: "thread.started", thread_id: native.session_id });
else if (mode === "cancel" || mode === "await_peer")
  await emit({ type: "item.completed", item: { type: "agent_message", text: "" } });
await nativeModule?.codexNativeEvents(nativeTools, native.session_id, emit);
if (mode === "await_peer") {
  const gate = await stateFile(cwd, "peer-cancelled");
  for (let attempt = 0; attempt < 300 && !(await Bun.file(gate).exists()); attempt++)
    await Bun.sleep(5);
  if (!(await Bun.file(gate).exists())) throw new Error("Peer cancellation was not observed");
}
if (task === "delayed_recover_once" && native.turn === 1) await Bun.sleep(1250);
if (mode === "active_once") await activeTurn(cwd, native.turn);
if (mode === "cancel") await Bun.sleep(30000);
else if (mode === "malformed") process.stdout.write("{broken\n");
else if (mode === "exit") process.exitCode = 7;
else if (mode !== "truncated" && !(mode === "recover_once" && native.turn === 1)) {
  if (delivery) await deliver(delivery, cwd, Boolean(resultSchema.properties.verdict));
  else if (
    resultSchema.properties.verdict &&
    mode === "recover_once" &&
    (await readFile(join(cwd, "DELIVERED.txt"), "utf8")) !== "Delivered by SDK stub"
  )
    throw new Error("Candidate file changed");
  else if (!resultSchema.properties.verdict && writable)
    await writeFile(join(cwd, "DELIVERED.txt"), "Delivered by SDK stub");
  const fallback = resultSchema.properties.verdict
    ? {
        verdict: task === "native_project_refused" ? "refuted" : "survived",
        evidence: "Checked preserved candidate",
      }
    : { ok: true, marker: cwd, turn: native.turn };
  const answer =
    mode === "invalid_output"
      ? "{"
      : JSON.stringify(await turnAnswer(schema, mode, native, raw, cwd, fallback));
  await emit({ type: "item.completed", item: { type: "agent_message", text: answer } });
  if (mode === "replaced_result")
    await emit({ type: "thread.started", thread_id: "replacement-session" });
  await emit({ type: "turn.completed", usage: { input_tokens: 4, output_tokens: 2 } });
}
