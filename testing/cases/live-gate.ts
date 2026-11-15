import { LiveGroup } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const liveGateCases = {
  positive: [
    positive("test-strategy > No live variable", [{}, LiveGroup.Runpod, ["RUNPOD_API_KEY"]], {
      run: false,
      failure: undefined,
    }),
    positive(
      "a different live variable does not enable the group",
      [{ TITAN_LIVE_CLAUDE: "1" }, LiveGroup.Runpod, ["RUNPOD_API_KEY"]],
      { run: false, failure: undefined },
    ),
    positive(
      "a value other than 1 does not enable the group",
      [{ TITAN_LIVE_RUNPOD: "true" }, LiveGroup.Runpod, ["RUNPOD_API_KEY"]],
      { run: false, failure: undefined },
    ),
    positive(
      "enabled group with its key runs",
      [{ TITAN_LIVE_CODEX: "1", OPENAI_API_KEY: "k" }, LiveGroup.Codex, ["OPENAI_API_KEY"]],
      { run: true, failure: undefined },
    ),
  ],
  negative: [
    rejected(
      "test-strategy > Live variable without its key",
      [{ TITAN_LIVE_RUNPOD: "1" }, LiveGroup.Runpod, ["RUNPOD_API_KEY"]],
      { run: true, failure: "RUNPOD_API_KEY is not set" },
    ),
    rejected(
      "an empty key counts as missing",
      [{ TITAN_LIVE_RUNPOD: "1", RUNPOD_API_KEY: "" }, LiveGroup.Runpod, ["RUNPOD_API_KEY"]],
      { run: true, failure: "RUNPOD_API_KEY is not set" },
    ),
  ],
};

const done = async () => {};

export const liveRunCases = {
  positive: [
    positive("a ready live test runs its action", [undefined, done], undefined),
    positive("a second ready live test runs its action", [undefined, async () => {}], undefined),
  ],
  negative: [
    negative("a missing key fails the live test", ["RUNPOD_API_KEY is not set", done], {
      message: "RUNPOD_API_KEY is not set",
    }),
    negative("another missing key fails the live test", ["OPENAI_API_KEY is not set", done], {
      message: "OPENAI_API_KEY is not set",
    }),
  ],
};
