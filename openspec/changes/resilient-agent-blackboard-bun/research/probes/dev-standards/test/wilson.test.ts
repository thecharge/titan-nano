import { expect, test } from "bun:test";
import fc from "fast-check";
import { wilson } from "../src/wilson";

test("examples from spec persona-lifecycle", () => {
	expect(wilson(17, 20).lo.toFixed(3)).toBe("0.640");
	expect(wilson(16, 20).lo.toFixed(3)).toBe("0.584");
	expect(wilson(16, 20).hi.toFixed(3)).toBe("0.919");
	expect(wilson(1, 8).hi.toFixed(3)).toBe("0.471");
});
test("property: 0 <= lo <= rate <= hi <= 1 for every count", () => {
	fc.assert(
		fc.property(
			fc
				.integer({ min: 1, max: 10_000 })
				.chain((n) => fc.tuple(fc.integer({ min: 0, max: n }), fc.constant(n))),
			([s, n]) => {
				const { lo, hi } = wilson(s, n),
					p = s / n,
					eps = 1e-12;
				return lo >= -eps && lo <= p + eps && p <= hi + eps && hi <= 1 + eps;
			},
		),
		{ seed: 42, numRuns: 1000 },
	);
});
test("property: more results make the interval narrower", () => {
	fc.assert(
		fc.property(
			fc.integer({ min: 1, max: 500 }),
			fc.double({ min: 0, max: 1, noNaN: true }),
			(n, r) => {
				const s = Math.round(r * n);
				const a = wilson(s, n),
					b = wilson(4 * s, 4 * n);
				return b.hi - b.lo < a.hi - a.lo;
			},
		),
		{ seed: 42, numRuns: 1000 },
	);
});
