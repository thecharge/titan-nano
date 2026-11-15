export {};

// A fake agent CLI: reads a task on stdin, prints a scripted JSON answer.
const task = await new Response(Bun.stdin.stream()).text();
console.log(
	JSON.stringify({
		result: `fake answer to: ${task.trim()}`,
		usage: { input: 0, output: 0 },
	}),
);
