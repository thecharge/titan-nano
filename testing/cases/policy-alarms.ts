import { PolicyAlarmFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const code = PolicyAlarmFixture.Code;
const research = PolicyAlarmFixture.Research;

export const serialAlarmCases = {
  positive: [
    positive(
      "self-training-orchestration > Policy collapsed to one agent: 12 of 20 narrow gives a board line and bonus 0.1 ending at run 50",
      [code, 12, 20, 4, 30, undefined],
      "1 0.100 50",
    ),
    positive(
      "self-training-orchestration > Policy collapsed to one agent: all 20 narrow at run 5 ends at run 25",
      [code, 20, 20, 4, 5, undefined],
      "1 0.100 25",
    ),
    positive(
      "self-training-orchestration > Policy collapsed to one agent: active alarm halves the bonus after 10 runs without a second line",
      [code, 12, 20, 4, 40, 30],
      "0 0.050 50",
    ),
    positive(
      "self-training-orchestration > Policy collapsed to one agent: expired alarm raises a new one",
      [code, 12, 20, 4, 40, 10],
      "1 0.100 60",
    ),
  ],
  negative: [
    rejected(
      "self-training-orchestration > Policy collapsed to one agent: exactly half narrow is not more than half",
      [code, 10, 20, 4, 30, undefined],
      "0 none none",
    ),
    rejected(
      "self-training-orchestration > Parallel limit prevents width above one: limit 1 gives no alarm",
      [code, 12, 20, 1, 30, undefined],
      "0 none none",
    ),
    rejected(
      "self-training-orchestration > Policy collapsed to one agent: only the last 20 runs count",
      [code, 12, 25, 4, 30, undefined],
      "0 none none",
    ),
  ],
};

export const emptyAlarmCases = {
  positive: [
    positive(
      "self-training-orchestration > Too many agents for the parts: 15 of 100 empty gives a board line and multiplier 2 with w_agent kept",
      [research, 20, 5, 15, 0.01],
      "1 2 0.01 0.15",
    ),
    positive(
      "self-training-orchestration > Too many agents for the parts: 11 of 100 empty is over 10 percent",
      [research, 20, 5, 11, 0.01],
      "1 2 0.01 0.11",
    ),
  ],
  negative: [
    rejected(
      "self-training-orchestration > Too many agents for the parts: exactly 10 percent keeps multiplier 1",
      [research, 20, 5, 10, 0.01],
      "0 1 0.01 0.10",
    ),
    rejected(
      "self-training-orchestration > Too many agents for the parts: a window with no split workers has share 0",
      [research, 20, 0, 0, 0.01],
      "0 1 0.01 0.00",
    ),
  ],
};
