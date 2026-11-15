import { ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const reply = { ok: true };
const delivered = { answer: reply, events: 1, called: 1 };
const admitted = { answer: null, events: 0, called: 0 };
const missing = {
  code: ErrorCode.FakeUnscripted,
  message: "fake backend has no script for task: other",
};

export const fakeDefaultCases = {
  positive: [
    positive("explicit handler serves a new session", [true, false, false], delivered),
    positive("explicit handler serves a resumed session", [true, true, false], delivered),
    positive("new handler admission does not invoke it", [true, false, true], admitted),
    positive("resumed handler admission does not invoke it", [true, true, true], admitted),
  ],
  negative: [
    negative("new default session cannot manufacture an answer", [false, false, false], missing),
    negative("resumed default session cannot manufacture an answer", [false, true, false], missing),
    negative("new default admission names its missing task", [false, false, true], missing),
    negative("resumed default admission names its missing task", [false, true, true], missing),
  ],
};
