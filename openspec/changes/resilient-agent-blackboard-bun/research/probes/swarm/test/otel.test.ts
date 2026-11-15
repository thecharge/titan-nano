// Probe: turn a fake titan run record into OpenTelemetry spans with the GenAI
// operation names from S17. The exporter keeps spans in memory: no network.
import { expect, test } from "bun:test";
import { SpanKind, context, trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

type RecordEvent =
  | { kind: "run_started"; run: string; workflow: string }
  | { kind: "step_started"; step: string; persona: string }
  | { kind: "tool_called"; step: string; tool: string }
  | { kind: "step_done"; step: string }
  | { kind: "run_done" };

const fakeRecord: RecordEvent[] = [
  { kind: "run_started", run: "r1", workflow: "fix-bug" },
  { kind: "step_started", step: "s1", persona: "coder" },
  { kind: "tool_called", step: "s1", tool: "read_file" },
  { kind: "step_done", step: "s1" },
  { kind: "step_started", step: "s2", persona: "skeptic" },
  { kind: "step_done", step: "s2" },
  { kind: "run_done" },
];

test("run record to GenAI spans: invoke_workflow > invoke_agent > execute_tool", () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const tracer = provider.getTracer("titan-probe");
  const steps = new Map<string, ReturnType<typeof tracer.startSpan>>();
  let runSpan: ReturnType<typeof tracer.startSpan> | undefined;
  for (const e of fakeRecord) {
    if (e.kind === "run_started") {
      runSpan = tracer.startSpan(`invoke_workflow ${e.workflow}`, {
        kind: SpanKind.INTERNAL,
        attributes: { "gen_ai.operation.name": "invoke_workflow", "titan.run.id": e.run },
      });
    } else if (e.kind === "step_started") {
      const ctx = trace.setSpan(context.active(), runSpan!);
      steps.set(
        e.step,
        tracer.startSpan(
          `invoke_agent ${e.persona}`,
          { attributes: { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": e.persona, "titan.step.id": e.step } },
          ctx,
        ),
      );
    } else if (e.kind === "tool_called") {
      const ctx = trace.setSpan(context.active(), steps.get(e.step)!);
      tracer
        .startSpan(`execute_tool ${e.tool}`, { attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": e.tool } }, ctx)
        .end();
    } else if (e.kind === "step_done") steps.get(e.step)!.end();
    else runSpan!.end();
  }
  const spans = exporter.getFinishedSpans();
  const byId = new Map(spans.map((s) => [s.spanContext().spanId, s.name]));
  const tree = spans.map((s) => `${s.name} <- ${byId.get(s.parentSpanContext?.spanId ?? "") ?? "(root)"}`);
  console.log(tree.join("\n"));
  expect(spans.length).toBe(4);
  expect(tree).toContain("execute_tool read_file <- invoke_agent coder");
  expect(tree).toContain("invoke_agent skeptic <- invoke_workflow fix-bug");
  expect(tree).toContain("invoke_workflow fix-bug <- (root)");
});
