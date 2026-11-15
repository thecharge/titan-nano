import { pipeline } from "@huggingface/transformers";
const t0 = performance.now();
const extract = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const out = await extract(["check time zones first", "the clock is in UTC", "plan a cheap move"], { pooling: "mean", normalize: true });
const v = out.tolist() as number[][];
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
console.log("dims", v[0].length, "sim(tz,utc)", dot(v[0], v[1]).toFixed(3), "sim(tz,move)", dot(v[0], v[2]).toFixed(3), "ms", Math.round(performance.now() - t0));
