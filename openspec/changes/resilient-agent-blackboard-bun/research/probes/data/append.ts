import { appendFileSync } from "node:fs";
const id = process.argv[2];
for (let i = 0; i < 2000; i++) appendFileSync("board.jsonl", JSON.stringify({ from: "p" + id, i, body: "x".repeat(300) }) + "\n");
