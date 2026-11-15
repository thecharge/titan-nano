import { CommandCaptureFixture, CommandCaptureLimit, ErrorCode } from "@titan/constants";
import { CommandCaptureMessage } from "@titan/messages";
import { negative, positive } from "@titan/test-factories";

export const commandCaptureCases = {
  positive: [
    positive(
      "both binary pipes retain their exact ceilings",
      [CommandCaptureFixture.Complete],
      true,
    ),
    positive("completed nonzero exit retains its bytes", [CommandCaptureFixture.Nonzero], true),
    positive("empty companion argument remains valid", [CommandCaptureFixture.EmptyArgument], true),
  ],
  negative: [
    negative("group stop failure remains explicit", [CommandCaptureFixture.GroupStopFailure], {
      message: CommandCaptureMessage.Signal,
    }),
    negative(
      "child stop failure retains the first failure",
      [CommandCaptureFixture.ChildStopFailure],
      {
        message: CommandCaptureMessage.Signal,
      },
    ),
    negative("empty command is refused before starting", [CommandCaptureFixture.EmptyCommand], {
      name: "ZodError",
    }),
    negative("zero byte argument is refused before starting", [CommandCaptureFixture.ZeroByte], {
      name: "ZodError",
    }),
    negative(
      "excess arguments are refused before starting",
      [CommandCaptureFixture.ExcessArguments],
      {
        name: "ZodError",
      },
    ),
    negative(
      "invalid budgets are refused before starting",
      [CommandCaptureFixture.InvalidOptions],
      {
        name: "ZodError",
      },
    ),
    negative("stdout overflow closes the owned child", [CommandCaptureFixture.StdoutOverflow], {
      code: ErrorCode.StreamLimit,
    }),
    negative("stderr overflow closes the owned child", [CommandCaptureFixture.StderrOverflow], {
      code: ErrorCode.StreamLimit,
    }),
    negative("signal cannot become a completed result", [CommandCaptureFixture.Signal], {
      code: ErrorCode.ExecutionInterrupted,
    }),
    negative("cancellation closes and awaits its child", [CommandCaptureFixture.Cancel], {
      name: "AbortError",
    }),
    negative("pre-cancellation starts no child", [CommandCaptureFixture.PreCancelled], {
      name: "AbortError",
    }),
    negative("deadline closes a held child", [CommandCaptureFixture.Timeout], {
      code: ErrorCode.CommandTimeout,
    }),
    negative("deadline closes inherited descendant pipes", [CommandCaptureFixture.Descendant], {
      code: ErrorCode.CommandTimeout,
    }),
  ],
};

export const commandCaptureArgumentCases = {
  positive: [
    positive("one executable remains exact", [["program"]], ["program"]),
    positive("empty argument remains separate", [["program", ""]], ["program", ""]),
  ],
  negative: [
    negative("absent executable fails admission", [[]], { name: "ZodError" }),
    negative("empty executable fails admission", [["", "argument"]], { name: "ZodError" }),
    negative("zero byte fails admission", [["program", "\0"]], { name: "ZodError" }),
    negative(
      "excess argument count fails admission",
      [Array.from({ length: CommandCaptureLimit.Arguments + 1 }, () => "program")],
      { name: "ZodError" },
    ),
    negative(
      "excess single argument fails admission",
      [["program", "x".repeat(CommandCaptureLimit.ArgumentCharacters + 1)]],
      { name: "ZodError" },
    ),
    negative(
      "aggregate command text stays finite",
      [Array.from({ length: 9 }, () => "x".repeat(CommandCaptureLimit.ArgumentCharacters))],
      { name: "ZodError" },
    ),
  ],
};

export const commandCaptureOptionCases = {
  positive: [
    positive("default budgets remain central", [{}], {
      maximum_bytes: CommandCaptureLimit.Bytes,
      timeout_ms: CommandCaptureLimit.DefaultMilliseconds,
    }),
    positive("smaller budgets remain exact", [{ maximum_bytes: 1, timeout_ms: 1 }], {
      maximum_bytes: 1,
      timeout_ms: 1,
    }),
  ],
  negative: [
    negative("zero bytes cannot disable the ceiling", [{ maximum_bytes: 0 }], { name: "ZodError" }),
    negative("zero time cannot disable the deadline", [{ timeout_ms: 0 }], { name: "ZodError" }),
    negative("unknown owner setting fails", [{ shell: true }], { name: "ZodError" }),
    negative("text cannot coerce a deadline", [{ timeout_ms: "1" }], { name: "ZodError" }),
    negative(
      "bytes cannot exceed the owner ceiling",
      [{ maximum_bytes: CommandCaptureLimit.Bytes + 1 }],
      { name: "ZodError" },
    ),
    negative(
      "time cannot exceed the owner ceiling",
      [{ timeout_ms: CommandCaptureLimit.MaximumMilliseconds + 1 }],
      { name: "ZodError" },
    ),
  ],
};
