import { CliCommand, CliObservationFault, ExitCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const cliEnvelopeProcessCases = {
  positive: [
    positive("sequential delivery returns one versioned envelope", [false, false], true),
    positive("parallel delivery returns one versioned envelope", [true, false], true),
  ],
  negative: [
    rejected("sequential credential wait retains recovery and exit three", [false, true], true),
    rejected("parallel credential wait retains recovery and exit three", [true, true], true),
  ],
};

export const cliEnvelopeQueryCases = {
  positive: [
    positive("version uses the ordinary envelope", [["--version"], ExitCode.Success], true),
    positive("help uses the ordinary envelope", [["--help"], ExitCode.Success], true),
  ],
  negative: [
    rejected("unknown command returns a structured error", [["unknown"], ExitCode.Input], true),
    rejected(
      "protocol JSON refusal returns a structured error",
      [[CliCommand.Mcp], ExitCode.Input],
      true,
    ),
  ],
};

export const cliOutputObservationCases = {
  positive: [
    positive("detached result retains its committed page", [false, CliObservationFault.None], true),
    positive("watched result retains its final page", [true, CliObservationFault.None], true),
  ],
  negative: [
    rejected("page failure retains known run recovery", [false, CliObservationFault.Events], true),
    rejected(
      "watched state failure retains known run recovery",
      [true, CliObservationFault.State],
      true,
    ),
    rejected(
      "unexpected observer exception is preserved",
      [false, CliObservationFault.Unexpected],
      true,
    ),
  ],
};

export const cliOutputObservationProcessCases = {
  positive: [
    positive("status drains a large active page through a pipe", [false, false], true),
    positive("watched status drains a large final page through a pipe", [true, false], true),
  ],
  negative: [
    rejected("process retains run recovery when its page fails", [false, true], true),
    rejected("process retains run recovery when its watched state crosses", [true, true], true),
  ],
};
