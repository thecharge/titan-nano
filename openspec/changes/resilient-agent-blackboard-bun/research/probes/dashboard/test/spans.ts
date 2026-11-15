// Turn the fake run into OpenTelemetry spans with the GenAI names, and send them.
import { context, trace, type Span } from "@opentelemetry/api";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { events, RUN_ID, WORKFLOW } from "./fake-run";

export async function sendRun(url: string, headers: Record<string, string> = {}, service = "titan") {
	const exporter = new OTLPTraceExporter({ url, headers });
	const provider = new BasicTracerProvider({
		resource: resourceFromAttributes({ "service.name": service, "openinference.project.name": service }),
		spanProcessors: [new SimpleSpanProcessor(exporter)],
	});
	const tracer = provider.getTracer("titan-probe");
	const at = (k: string, step?: string) => events.find((e) => e.kind === k && (!step || e.step === step))!;
	const run = tracer.startSpan(`invoke_workflow ${WORKFLOW}`, { startTime: at("run_started").t, attributes: { "gen_ai.operation.name": "invoke_workflow", "titan.run.id": RUN_ID } });
	const ctx = trace.setSpan(context.active(), run);
	let n = 1;
	for (const step of ["prove", "review"]) {
		const s = at("agent_started", step), a = at("agent_answered", step);
		const agent: Span = tracer.startSpan(`invoke_agent ${s.persona}`, { startTime: s.t, attributes: {
			"gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": s.persona!, "titan.step.id": step,
			"gen_ai.usage.input_tokens": a.tokens_in!, "gen_ai.usage.output_tokens": a.tokens_out!, "titan.cost_usd": a.cost_usd!,
		} }, ctx);
		n++;
		const tool = events.find((e) => e.kind === "tool_called" && e.step === step);
		if (tool) {
			const tctx = trace.setSpan(ctx, agent);
			tracer.startSpan(`execute_tool ${tool.tool}`, { startTime: tool.t, attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": tool.tool! } }, tctx).end(tool.t + 1900);
			n++;
		}
		const chk = events.find((e) => e.kind === "check_done" && e.step === step);
		if (chk) agent.setAttribute("titan.check.verdict", chk.proof!);
		if (a.verdict) agent.setAttribute("titan.falsify.verdict", a.verdict);
		agent.end(a.t);
	}
	run.setAttribute("titan.run.verdict", "passed");
	run.end(at("run_ended").t);
	await provider.forceFlush();
	await provider.shutdown();
	return n; // spans sent
}
