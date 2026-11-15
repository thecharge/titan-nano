// Z3 as a deterministic checker: "unsat" of the negation is a proof,
// "sat" gives a counterexample that becomes the evidence of a refutation.
import { expect, test } from "bun:test";
import { init } from "z3-solver";

test("z3 under bun: proof and counterexample", async () => {
	const t0 = performance.now();
	const { Context } = await init();
	const { Solver, Int, Not, Implies, And } = new (Context as any)("main");
	console.log(`init ms ${Math.round(performance.now() - t0)}`);

	// Claim 1: for all integers x, y > 0, x + y > x. Check the negation.
	const x = Int.const("x");
	const y = Int.const("y");
	const s1 = new Solver();
	s1.add(Not(Implies(And(x.gt(0), y.gt(0)), x.add(y).gt(x))));
	const r1 = await s1.check();
	console.log(`claim "x>0 and y>0 implies x+y>x": negation is ${r1}`);
	expect(r1).toBe("unsat");

	// Claim 2 (false): for all integers x, x * x > x.
	const s2 = new Solver();
	s2.add(Not(x.mul(x).gt(x)));
	const r2 = await s2.check();
	const m = s2.model();
	console.log(`claim "x*x > x": negation is ${r2}, counterexample x = ${m.eval(x).toString()}`);
	expect(r2).toBe("sat");

	// Claim 3: SMT-LIB text, the form a workflow file would hold.
	const s3 = new Solver();
	s3.fromString("(declare-const a Int) (assert (> a 10)) (assert (< a 5))");
	const r3 = await s3.check();
	console.log(`SMT-LIB "a>10 and a<5": ${r3}`);
	expect(r3).toBe("unsat");
	console.log(`total ms ${Math.round(performance.now() - t0)}`);
	process.exit(0); // the wasm worker threads keep the process alive
}, 60000);
