// Wilson score interval, 95 % (z = 1.96), as in spec persona-lifecycle.
export function wilson(
	survived: number,
	n: number,
	z = 1.96,
): { lo: number; hi: number } {
	if (n === 0) return { lo: 0, hi: 1 };
	const p = survived / n,
		z2 = z * z;
	const c = (p + z2 / (2 * n)) / (1 + z2 / n);
	const h =
		(z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
	return { lo: c - h, hi: c + h };
}
