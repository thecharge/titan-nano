// Lists every "#### Scenario:" in the OpenSpec specs, and every test title written as
// test("<spec> > <scenario>", ...) in the test files. Fails when a scenario has no test,
// or a scenario test names a scenario that does not exist.
import { Glob } from "bun";
const [specDir, testDir] = Bun.argv.slice(2);
const scenarios = new Set<string>();
for await (const f of new Glob("*/spec.md").scan(specDir!)) {
  const spec = f.split("/")[0];
  for (const m of (await Bun.file(`${specDir}/${f}`).text()).matchAll(/^#### Scenario: (.+)$/gm)) scenarios.add(`${spec} > ${m[1]!.trim()}`);
}
const tested = new Set<string>();
for await (const f of new Glob("**/*.test.ts").scan(testDir!)) {
  for (const m of (await Bun.file(`${testDir}/${f}`).text()).matchAll(/test\(\s*"([a-z0-9-]+ > [^"]+)"/g)) tested.add(m[1]!);
}
const missing = [...scenarios].filter((s) => !tested.has(s));
const unknown = [...tested].filter((s) => !scenarios.has(s));
console.log(`${scenarios.size} scenarios, ${scenarios.size - missing.length} with a test, ${missing.length} without, ${unknown.length} unknown`);
for (const s of unknown) console.log(`unknown: ${s}`);
for (const s of missing.slice(0, 5)) console.log(`missing: ${s}`);
if (missing.length > 5) console.log(`... and ${missing.length - 5} more`);
process.exit(missing.length || unknown.length ? 1 : 0);
