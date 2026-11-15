// Probe of @langchain/langgraph 1.5.2: checkpoints, resume after a crash, and
// interrupt replay. No model at all: the nodes are plain functions.
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Annotation, Command, END, MemorySaver, START, StateGraph, interrupt } from "@langchain/langgraph";

const State = Annotation.Root({
  log: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

async function saver(kind: "memory" | "sqlite") {
  if (kind === "memory") return new MemorySaver();
  const { SqliteSaver } = await import("@langchain/langgraph-checkpoint-sqlite");
  return SqliteSaver.fromConnString(join(mkdtempSync(join(tmpdir(), "lg-")), "cp.db"));
}

for (const kind of ["memory", "sqlite"] as const) {
  test(`${kind}: a crash in step b resumes at b, and step a does not run again`, async () => {
    const runs = { a: 0, b: 0 };
    let crash = true;
    const g = new StateGraph(State)
      .addNode("a", () => {
        runs.a++;
        return { log: ["a"] };
      })
      .addNode("b", () => {
        runs.b++;
        if (crash) throw new Error("worker died");
        return { log: ["b"] };
      })
      .addEdge(START, "a")
      .addEdge("a", "b")
      .addEdge("b", END)
      .compile({ checkpointer: await saver(kind) });
    const cfg = { configurable: { thread_id: "t1" } };
    await expect(g.invoke({ log: [] }, cfg)).rejects.toThrow("worker died");
    crash = false;
    const out = await g.invoke(null, cfg); // resume from the last checkpoint
    console.log(`${kind}: runs`, runs, "log", out.log);
    expect(runs).toEqual({ a: 1, b: 2 });
    expect(out.log).toEqual(["a", "b"]);
  });
}

test("interrupt: code before interrupt() in the same node runs again on resume", async () => {
  let before = 0;
  const g = new StateGraph(State)
    .addNode("ask", () => {
      before++; // a side effect before the question, such as a tool call
      const answer = interrupt("approve?") as string;
      return { log: [`answer=${answer}`] };
    })
    .addEdge(START, "ask")
    .addEdge("ask", END)
    .compile({ checkpointer: new MemorySaver() });
  const cfg = { configurable: { thread_id: "t2" } };
  const first = await g.invoke({ log: [] }, cfg);
  const paused = "__interrupt__" in first;
  const out = await g.invoke(new Command({ resume: "yes" }), cfg);
  console.log("interrupt: paused =", paused, "| code before interrupt ran", before, "times | log", out.log);
  expect(paused).toBe(true);
  expect(before).toBe(2);
  expect(out.log).toEqual(["answer=yes"]);
});
