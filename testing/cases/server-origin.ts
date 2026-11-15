import { HttpStatus, ServerHolder, ServerStartupFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverOriginCases = {
  positive: [
    positive(
      "agent token without an origin is accepted",
      [ServerHolder.Agent, ServerStartupFixture.NoOrigin],
      HttpStatus.Ok,
    ),
    positive(
      "person token without an origin is accepted",
      [ServerHolder.Person, ServerStartupFixture.NoOrigin],
      HttpStatus.Ok,
    ),
  ],
  negative: [
    rejected(
      "agent token from a foreign page is forbidden",
      [ServerHolder.Agent, ServerStartupFixture.Foreign],
      HttpStatus.Forbidden,
    ),
    rejected(
      "person token from a foreign page is forbidden",
      [ServerHolder.Person, ServerStartupFixture.Foreign],
      HttpStatus.Forbidden,
    ),
    rejected(
      "agent token from an opaque origin is forbidden",
      [ServerHolder.Agent, ServerStartupFixture.Opaque],
      HttpStatus.Forbidden,
    ),
    rejected(
      "person token from an opaque origin is forbidden",
      [ServerHolder.Person, ServerStartupFixture.Opaque],
      HttpStatus.Forbidden,
    ),
  ],
};
