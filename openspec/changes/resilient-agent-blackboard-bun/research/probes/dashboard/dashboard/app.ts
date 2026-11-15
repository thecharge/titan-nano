export {};
// Browser code. Bun bundles it into the page; nothing loads from a CDN.
type Run = Record<string, any>;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
async function load() {
	const runs: Run[] = await (await fetch("/api/runs")).json();
	const rows = runs.map((r) => `<tr><td>${esc(r.run)}</td><td class="${esc(r.status)}">${esc(r.status)}</td><td>${esc(r.steps.join(" → "))}</td>
		<td>${(r.elapsed_ms / 1000).toFixed(1)} s</td><td>${r.attempts}</td><td>${r.most_agents_at_once}</td>
		<td>${r["gen_ai.usage.input_tokens"]} / ${r["gen_ai.usage.output_tokens"]}</td><td>$${r.cost_usd}</td>
		<td>${Object.entries(r.verdicts).map(([k, v]) => `${esc(k)} ${v}`).join(", ")}</td>
		<td>${Object.entries(r.proofs).map(([k, v]) => `<span class="${esc(k)}">${esc(k)} ${v}</span>`).join(" ")}</td></tr>`);
	document.querySelector("#runs")!.innerHTML = `<table><tr><th>run</th><th>status</th><th>steps</th><th>elapsed</th><th>attempts</th><th>agents at once</th><th>tokens in / out</th><th>cost</th><th>falsify verdicts</th><th>proofs</th></tr>${rows.join("")}</table>`;
	return runs;
}
const runs = await load();
const live = runs.find((r) => r.status === "running");
if (live) {
	document.querySelector("#live-title")!.textContent = `live: ${live.run}`;
	const es = new EventSource(`/api/runs/${live.run}/events`);
	es.onmessage = (m) => {
		const li = document.createElement("li");
		li.textContent = m.data;
		document.querySelector("#live")!.append(li);
		void load();
	};
}
