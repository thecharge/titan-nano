import {
  Backend,
  ErrorCode,
  LimitAction,
  LimitFixture,
  LimitTest,
  RunAction,
  RunBlock,
  RunStatus,
  StepStatus,
} from "@titan/constants";
import { limitTimeLeft } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const at = (hour: number, minute: number): Date =>
  new Date(LimitTest.Year, LimitTest.Month, LimitTest.Day, hour, minute, 0, 0);
const minutes = (count: number): number => count * 60_000;
const worker = (backend: string, task: string): string[] => [backend, task];
const first = worker(Backend.Claude, LimitTest.First);
const claudeSecond = worker(Backend.Claude, LimitTest.Second);
const codexSecond = worker(Backend.Codex, LimitTest.Second);
const blocked = {
  state: RunStatus.Blocked,
  error: RunBlock.Limit,
  step: StepStatus.Blocked,
  retry: true,
  finalState: RunStatus.Blocked,
  calls: [first, claudeSecond],
};
const farBlocked = { ...blocked, retry: false };
const passed = {
  state: RunStatus.Passed,
  error: null,
  step: StepStatus.Passed,
  retry: false,
  finalState: RunStatus.Passed,
  calls: [first, claudeSecond],
};
const resumed = {
  ...blocked,
  finalState: RunStatus.Passed,
  calls: [first, claudeSecond, claudeSecond],
};

export const limitDelayCases = {
  positive: [
    positive("10:50am from 9:00 is 110 minutes away", [LimitTest.Text, at(9, 0)], minutes(110)),
    positive(
      "10:50am from 11:00 is on the next day",
      [LimitTest.Text, at(11, 0)],
      minutes(23 * 60 + 50),
    ),
    positive(
      "noon without minutes",
      ["You've hit your limit · resets 12pm", at(11, 0)],
      minutes(60),
    ),
    positive(
      "12:05am from 23:00 is the next day",
      ["You've hit your 5-hour limit · resets 12:05am", at(23, 0)],
      minutes(65),
    ),
  ],
  negative: [
    rejected("a plain answer has no limit", [LimitTest.Plain, at(9, 0)], null),
    rejected("a limit without a time", ["You've hit your 5-hour limit", at(9, 0)], null),
    rejected("a time without a limit", ["The shop resets 10:50am", at(9, 0)], null),
  ],
};

export const minutesLeftCases = {
  positive: [
    positive("ninety minutes", [minutes(90), 0], 90),
    positive("a started minute counts whole", [minutes(1) + 1, 0], 2),
  ],
  negative: [
    rejected("a past time shows one minute", [0, minutes(5)], 1),
    rejected("under a minute shows one minute", [1000, 0], 1),
  ],
};

export const limitUntilCases = {
  positive: [
    positive(
      "a future retry is the time left",
      [{ one: { phases: { worker: { next_retry: 5000, completed: false } } } }, 1000],
      5000,
    ),
    positive(
      "the nearest retry wins",
      [
        {
          one: { phases: { worker: { next_retry: 9000, completed: false } } },
          two: { phases: { worker: { next_retry: 4000, completed: false } } },
        },
        1000,
      ],
      4000,
    ),
  ],
  negative: [
    rejected(
      "a retry in the past is ignored",
      [{ one: { phases: { worker: { next_retry: 500, completed: false } } } }, 1000],
      null,
    ),
    rejected(
      "a completed phase is ignored",
      [{ one: { phases: { worker: { next_retry: 5000, completed: true } } } }, 1000],
      null,
    ),
    rejected("malformed nodes are ignored", ["not nodes", 1000], null),
  ],
};

export const resumeBackendCases = {
  positive: [
    positive("a known backend is kept", [Backend.Codex], Backend.Codex),
    positive("no backend means no change", [null], undefined),
  ],
  negative: [
    negative("an unknown backend is refused", ["gpt"], { code: ErrorCode.Backend }),
    negative("an empty backend is refused", [""], { code: ErrorCode.Backend }),
  ],
};

export const limitRecordCases = {
  positive: [
    positive(
      "a worker limit blocks the run with a retry time",
      [LimitFixture.Near, LimitAction.None],
      blocked,
    ),
    positive(
      "a later reset time is kept as a later retry time",
      [LimitFixture.Far, LimitAction.None],
      farBlocked,
    ),
  ],
  negative: [
    rejected(
      "an answer without a limit does not block",
      [LimitFixture.Clear, LimitAction.None],
      passed,
    ),
    rejected(
      "a reset time far away is not a near retry",
      [LimitFixture.Far, LimitAction.None],
      farBlocked,
    ),
  ],
};

export const limitAutomaticCases = {
  positive: [
    positive(
      "the run continues at the stopped step once the reset time passes",
      [LimitFixture.Near, LimitAction.Wait],
      resumed,
    ),
    positive(
      "a person can resume before the reset time",
      [LimitFixture.Near, LimitAction.Resume],
      resumed,
    ),
  ],
  negative: [
    rejected(
      "the run does not continue before the reset time",
      [LimitFixture.Far, LimitAction.Wait],
      farBlocked,
    ),
    rejected(
      "a run that never hit a limit has nothing to wait for",
      [LimitFixture.Clear, LimitAction.Wait],
      passed,
    ),
  ],
};

export const limitSwitchCases = {
  positive: [
    positive(
      "the stopped step continues with Codex and the finished step keeps its result",
      [LimitFixture.Far, LimitAction.Switch],
      { ...farBlocked, finalState: RunStatus.Passed, calls: [first, claudeSecond, codexSecond] },
    ),
    positive(
      "a switch before a near reset time also continues with Codex",
      [LimitFixture.Near, LimitAction.Switch],
      { ...blocked, finalState: RunStatus.Passed, calls: [first, claudeSecond, codexSecond] },
    ),
  ],
  negative: [
    rejected(
      "without a backend the stopped step stays with Claude",
      [LimitFixture.Near, LimitAction.Resume],
      resumed,
    ),
    negative("a finished run cannot be switched", [LimitFixture.Clear, LimitAction.Switch], {
      code: ErrorCode.TerminalRun,
    }),
  ],
};

const waiting = {
  one: { phases: { worker: { next_retry: Date.now() + minutes(90), completed: false } } },
};
const control = (backend: string | undefined): unknown[] => ["run-1", RunAction.Resume, backend];

export const cliResumeCases = {
  positive: [
    positive(
      "resume passes the backend to the server",
      [["resume", "run-1", "--backend", Backend.Codex], {}],
      { seen: [control(Backend.Codex)], messages: [] },
    ),
    positive("resume before the reset time says how long is left", [["resume", "run-1"], waiting], {
      seen: [control(undefined)],
      messages: [limitTimeLeft(90)],
    }),
  ],
  negative: [
    rejected("resume with no retry time says nothing", [["resume", "run-1"], {}], {
      seen: [control(undefined)],
      messages: [],
    }),
    negative("resume refuses an unknown backend", [["resume", "run-1", "--backend", "gpt"], {}], {
      code: ErrorCode.Backend,
    }),
  ],
};
