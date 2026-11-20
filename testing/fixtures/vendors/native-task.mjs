import { appendFile, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stateFile } from "./state.mjs";

export async function nativeTask(task, tools, prompt, cwd, writable) {
  if (task === "native_file_write" || task === "native_file_write_refused") {
    if (!tools) throw new Error("Native tools were required by the scripted task");
    await tools.executeFileWrite(writable, task === "native_file_write_refused");
    return "complete";
  }
  const input = typeof prompt === "string" && prompt.startsWith("{") ? JSON.parse(prompt) : null;
  if (task === "request_turn_web") {
    if (!tools || !writable) throw new Error("Web read requires the worker native binding");
    await tools.executeWebRead(input?.request_answers?.[0]);
    return "request_turn";
  }
  if (
    writable &&
    (["capture_received", "sealed_received", "split_received"].includes(
      input?.reconciliation?.original_task,
    ) ||
      input?.reconciliation?.original_result?.stdout === "Script result")
  ) {
    if (
      (!input.reconciliation.original_result?.ok &&
        input.reconciliation.original_result?.exit_code !== 0 &&
        !(
          Array.isArray(input.reconciliation.original_result) &&
          input.reconciliation.original_result.length === 2 &&
          input.reconciliation.original_result.every((part) => part.ok)
        )) ||
      !input.reconciliation.current_input_hash
    )
      throw new Error("Reconciliation must retain its received result and bound input");
    const current = await readFile(join(input.reconciliation.current_input, "source.txt"), "utf8");
    if (
      current !== "External edit" ||
      (await readFile(join(cwd, "source.txt"), "utf8")) !== current
    )
      throw new Error("Reconciliation must preserve the current shared files");
    await appendFile(
      await stateFile(cwd, "reconciliation-calls.jsonl"),
      `${JSON.stringify(input.reconciliation)}\n`,
    );
    return "complete";
  }
  if (task === "split_source") return "complete";
  if (task === "capture_received" || task === "sealed_received" || task === "split_received") {
    if (!writable) throw new Error("Received worker must have its write capability");
    if (task === "split_received") {
      if (!tools || !Number.isInteger(input?.inputs?.part_index))
        throw new Error("Split worker requires a native binding and part index");
      await tools.executeSplit();
    }
    await appendFile(await stateFile(cwd, "original-calls.jsonl"), "original\n");
    await writeFile(join(cwd, "source.txt"), "Received worker edit");
    if (task === "capture_received" || (task === "split_received" && input.inputs.part_index === 1))
      await symlink("source.txt", join(cwd, "unsafe-link"));
    return "complete";
  }
  if (task === "native_project_write" || task === "native_project_refused") {
    if (!tools) throw new Error("Native tools were required by the scripted task");
    await tools.executeWrite();
    return "complete";
  }
  if (task !== "native_tools") return task;
  if (!tools) throw new Error("Native tools were required by the scripted task");
  await tools.execute();
  return "complete";
}
