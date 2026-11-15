import { Backend, ErrorCode, UsageHistoryFault } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const incrementalUsageCases = {
  positive: [
    positive("each intermediate report preserves eventual completeness", ["finish-each"], true),
    positive("incremental terminal usage matches journal reconstruction", ["finish-last"], true),
  ],
  negative: [
    rejected("a skipped event cannot advance usage", ["gap"], true),
    rejected("a repeated event cannot contribute twice", ["repeat"], true),
  ],
};

export const usageAccountingCases = {
  positive: [
    positive("all three quality attempts contribute once", [false], true),
    positive("reloaded journal retains earlier attempts", [true], true),
    positive(
      "Claude sessions on separate quality attempts remain additive",
      [false, false, false, 0.03, UsageHistoryFault.None, Backend.Claude],
      true,
    ),
    positive(
      "reloaded Claude attempts retain each independent session total",
      [true, false, false, 0.03, UsageHistoryFault.None, Backend.Claude],
      true,
    ),
  ],
  negative: [
    negative(
      "changed reported prefix cannot rewrite totals",
      [false, false, false, 0.03, UsageHistoryFault.ChangedUsage],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "reported usage cannot disappear",
      [false, false, false, 0.03, UsageHistoryFault.LessUsage],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "execution count cannot move backward",
      [false, false, false, 0.03, UsageHistoryFault.LessExecutions],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "reports cannot outnumber executions",
      [false, false, false, 0.03, UsageHistoryFault.MoreUsage],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "quality attempt cannot move backward",
      [false, false, false, 0.03, UsageHistoryFault.RewindAttempt],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "unknown phases cannot enlarge the bounded cursor store",
      [false, false, false, 0.03, UsageHistoryFault.UnknownPhase],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "a foreign run cannot contribute usage",
      [false, false, false, 0.03, UsageHistoryFault.WrongRun],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "future events cannot pass the committed report cursor",
      [false, false, false, 0.03, UsageHistoryFault.FutureCursor],
      { code: ErrorCode.CorruptBoard },
    ),
    negative(
      "overflow cannot become a finite cost report",
      [false, false, false, Number.MAX_VALUE],
      { code: ErrorCode.CorruptBoard },
    ),
    rejected("interrupted usage cannot appear complete", [false, true], true),
    rejected("unknown native cost cannot become zero cost", [true, false, true], true),
    rejected("restart cannot hide unreported executions", [true, true, true], true),
  ],
};
