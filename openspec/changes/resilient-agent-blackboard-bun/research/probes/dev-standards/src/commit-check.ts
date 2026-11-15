// Checks the first line of a commit message against Conventional Commits 1.0.0:
// <type>[optional scope][!]: <description>
const RE = /^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert|style)(\([a-z0-9-]+\))?!?: \S.{0,99}$/;
export const isConventional = (subject: string) => RE.test(subject);
if (import.meta.main) {
  const lines = (await Bun.stdin.text()).split("\n").filter(Boolean);
  let bad = 0;
  for (const l of lines) { const ok = isConventional(l); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${l}`); }
  console.log(`${lines.length - bad} ok, ${bad} fail`);
  process.exit(bad ? 1 : 0);
}
