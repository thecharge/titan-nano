import { afterAll } from "bun:test";
import { writeFile } from "node:fs/promises";
import { IoLimit, TestScheduling } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { positive, rejected, unit } from "@titan/test-factories";
import { SchedulingProbeSchema } from "@titan/types";

const settings = SchedulingProbeSchema.parse(
  JSON.parse(
    (
      await readFileBytes(
        new URL(TestScheduling.Settings, import.meta.url).pathname,
        IoLimit.DataBytes,
      )
    ).toString(),
  ),
);
let active = 0;
let peak = 0;
let completed = 0;
async function work(index) {
  active++;
  peak = Math.max(peak, active);
  try {
    await Bun.sleep(TestScheduling.DelayMilliseconds);
    if (settings.fail && index === 0) throw new Error("Deliberate scheduling failure");
    return index;
  } finally {
    active--;
    completed++;
  }
}
unit(
  work,
  {
    positive: [
      positive("first isolated case", [0], 0),
      positive("second isolated case", [1], 1),
      positive("third isolated case", [2], 2),
      positive("fourth isolated case", [3], 3),
      positive("fifth isolated case", [4], 4),
      positive("sixth isolated case", [5], 5),
    ],
    negative: [
      rejected("seventh isolated case", [6], 6),
      rejected("eighth isolated case", [7], 7),
      rejected("ninth isolated case", [8], 8),
      rejected("tenth isolated case", [9], 9),
      rejected("eleventh isolated case", [10], 10),
      rejected("twelfth isolated case", [11], 11),
    ],
  },
  undefined,
  settings.schedule,
);
afterAll(async () =>
  writeFile(settings.result, Buffer.from(JSON.stringify({ active, peak, completed }))),
);
