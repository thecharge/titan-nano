// Probe: can Bun's built-in transpiler give per-file import/export lists (no extra dependency)?
const src = `import { a } from "./x"; import fs from "node:fs"; export const k = 1; export function f(){ return a }; export default class C {}; const y = require("./y");`;
const t = new Bun.Transpiler({ loader: "ts" });
console.log("Bun", Bun.version);
console.log("scan:", JSON.stringify(t.scan(src)));
console.log("scanImports:", JSON.stringify(t.scanImports(src)));
