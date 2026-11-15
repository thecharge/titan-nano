import { FakeDefaultFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverProcessRecoveryCases = {
  positive: [
    positive("SIGKILL releases writer ownership and preserves the durable run", ["crash"], {
      recovered: true,
      ownerChanged: true,
    }),
    positive("graceful restart preserves the same durable run", ["graceful"], {
      recovered: true,
      ownerChanged: true,
    }),
  ],
  negative: [
    rejected("a live daemon rejects its competing writer", ["live"], {
      rejected: 2,
      ownerReady: true,
      ownerExit: null,
      ownerResponse: null,
      ownerError: "",
    }),
    rejected("simultaneous startup admits exactly one writer", ["race"], {
      rejected: 2,
      ownerReady: true,
      ownerExit: null,
      ownerResponse: null,
      ownerError: "",
    }),
  ],
};

export const scriptedFakeProcessCases = {
  positive: [
    positive("sequential CLI runs reproduce scripted results", [false, ""], true),
    positive("parallel CLI runs retain task-specific replies", [true, ""], true),
  ],
  negative: [
    rejected(
      "unconfigured sequential fake cannot invent success",
      [false, FakeDefaultFixture.MissingProfile],
      true,
    ),
    rejected(
      "unconfigured parallel fake cannot invent success",
      [true, FakeDefaultFixture.MissingProfile],
      true,
    ),
    rejected(
      "missing worker reply blocks without spending a model execution",
      [false, "worker"],
      true,
    ),
    rejected("missing checker reply preserves the quality attempt", [true, "checker"], true),
  ],
};

export const scriptedFakeWatchCases = {
  positive: [
    positive("default watched sequential run returns a passed result", [false, ""], true),
    positive("default watched parallel run returns independent results", [true, ""], true),
  ],
  negative: [
    rejected(
      "watched unconfigured sequential fake returns blocked",
      [false, FakeDefaultFixture.MissingProfile],
      true,
    ),
    rejected(
      "watched unconfigured parallel fake returns blocked",
      [true, FakeDefaultFixture.MissingProfile],
      true,
    ),
    rejected("default watched missing worker returns blocked exit", [false, "worker"], true),
    rejected(
      "default watched missing checker preserves the logical attempt",
      [true, "checker"],
      true,
    ),
  ],
};
