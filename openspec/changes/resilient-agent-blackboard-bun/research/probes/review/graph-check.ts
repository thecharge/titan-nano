// Mechanical check of design.md "Package dependencies" (lines 56-72) against edges implied by the specs.
// declared: transcribed from design.md:56-72. implied: each entry cites the spec/design line that forces the edge.
const declared: Record<string, string[]> = {
  core: [], board: ["core"], capability: ["core"], sandbox: ["core"], "mcp-gateway": ["core", "capability"], convergence: ["core"],
  context: ["core", "board"], personas: ["core", "context"], falsify: ["core", "sandbox", "board"], contracts: ["core", "board", "falsify"],
  decide: ["core", "board"], "safe-state": ["core", "board"],
  "control-shell": ["core", "board", "context", "personas", "mcp-gateway", "capability", "sandbox", "falsify", "contracts", "convergence", "decide", "safe-state"],
};
const implied: [string, string, string][] = [
  ["convergence", "board", "design.md:150 ErrorFn takes BoardView; convergence spec:4-8 counts datoms; spec:23 retracts patch datoms"],
  ["capability", "board", "capability-isolation spec:21 policy engine writes a `policy/denied` datom"],
  ["mcp-gateway", "board", "mcp-tool-discovery spec:27 gateway writes a `tool/revoked` datom"],
  ["sandbox", "capability", "sandboxed-execution spec:34 + tasks.md:53 sandbox output tagged untrusted and routed through Q"],
  ["sandbox", "board", "contracts spec:26 / sandboxed spec:40 `run/result` datom written"],
  ["personas", "board", "dynamic-persona-factory spec:12 persona/* datoms written to board"],
  ["context", "capability", "capability-isolation spec:5 P context limited to cap.source user|trusted-tool; context builds P prompts (design.md:112)"],
  ["decide", "convergence", "decision-protocols spec:38 gate requires E(s) not increased"],
  ["decide", "falsify", "decision-protocols spec:35-36 gate reads refutation budget + survival"],
  ["falsify", "personas", "falsification-engine spec:5 'Ask the Refuter persona for checks'"],
  ["falsify", "capability", "sandbox output must go through Q (sandboxed spec:34); falsify consumes check output"],
  ["safe-state", "convergence", "safe-state spec:20 writes last E(s)"],
  ["mcp-gateway", "sandbox", "mcp-tool-discovery spec:40 agent-written MCP servers started in tier B and listed through the gateway"],
  ["mcp-gateway", "safe-state", "createPullRequest (tasks.md:68) must push the checkpointed branch owned by safe-state (D15)"],
];
const missing = implied.filter(([a, b]) => !declared[a].includes(b));
console.log(`declared edges: ${Object.values(declared).flat().length}; implied edges checked: ${implied.length}; missing from design.md graph: ${missing.length}`);
for (const [a, b, why] of missing) console.log(`  MISSING ${a} -> ${b}   (${why})`);
// cycle check on declared ∪ implied
const g: Record<string, Set<string>> = {}; for (const [k, v] of Object.entries(declared)) g[k] = new Set(v);
for (const [a, b] of implied) g[a].add(b);
const cycles: string[] = []; const state: Record<string, number> = {};
const dfs = (n: string, path: string[]) => { state[n] = 1; for (const m of g[n] ?? []) { if (state[m] === 1) cycles.push([...path.slice(path.indexOf(m)), m].join(" -> ")); else if (!state[m]) dfs(m, [...path, m]); } state[n] = 2; };
for (const n of Object.keys(g)) if (!state[n]) dfs(n, [n]);
console.log(`cycles in declared+implied graph: ${cycles.length}`); for (const c of cycles) console.log("  CYCLE " + c);
// fan-in / fan-out
const fanIn: Record<string, number> = {}; for (const vs of Object.values(g)) for (const v of vs) fanIn[v] = (fanIn[v] ?? 0) + 1;
console.log("fan-out control-shell:", g["control-shell"].size, "| fan-in board:", fanIn.board, "| fan-in capability:", fanIn.capability);
// Proposed graph (finding A-03) check
const proposed: Record<string, string[]> = {
  core: [], board: ["core"], policy: ["core", "board"], effects: ["core", "board", "policy"],
  sandbox: ["core", "board", "policy"], "mcp-gateway": ["core", "board", "policy", "sandbox"], context: ["core", "board", "policy"],
  agents: ["core", "board", "context", "policy"], verify: ["core", "board", "sandbox", "agents", "policy"],
  decide: ["core", "board", "verify"], "control-shell": ["core", "board", "policy", "effects", "sandbox", "mcp-gateway", "context", "agents", "verify", "decide"],
};
const pst: Record<string, number> = {}; const pc: string[] = [];
const pd = (n: string, path: string[]) => { pst[n] = 1; for (const m of proposed[n]) { if (!proposed[m]) throw new Error("unknown " + m); if (pst[m] === 1) pc.push(path.join("->") + "->" + m); else if (!pst[m]) pd(m, [...path, m]); } pst[n] = 2; };
for (const n of Object.keys(proposed)) if (!pst[n]) pd(n, [n]);
console.log(`proposed graph: ${Object.keys(proposed).length} packages, ${Object.values(proposed).flat().length} edges, cycles: ${pc.length}`);
