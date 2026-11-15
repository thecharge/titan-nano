import { HttpStatus, KnowledgeHttpFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeHttpCases = {
  positive: [
    positive("authenticated get preserves the entry", [KnowledgeHttpFixture.Get], HttpStatus.Ok),
    positive(
      "authenticated search preserves the entry",
      [KnowledgeHttpFixture.Search],
      HttpStatus.Ok,
    ),
  ],
  negative: [
    rejected(
      "malformed JSON cannot change entries",
      [KnowledgeHttpFixture.Malformed],
      HttpStatus.BadRequest,
    ),
    rejected(
      "unknown entry fields cannot change entries",
      [KnowledgeHttpFixture.Invalid],
      HttpStatus.BadRequest,
    ),
    rejected(
      "unsupported method cannot change entries",
      [KnowledgeHttpFixture.Method],
      HttpStatus.BadRequest,
    ),
    rejected(
      "unexpected query cannot change entries",
      [KnowledgeHttpFixture.Query],
      HttpStatus.BadRequest,
    ),
    rejected(
      "missing credentials cannot read the hub",
      [KnowledgeHttpFixture.Unauthorized],
      HttpStatus.Unauthorized,
    ),
    rejected(
      "browser origin cannot access the hub",
      [KnowledgeHttpFixture.Origin],
      HttpStatus.Forbidden,
    ),
    rejected(
      "stale deletion reports a conflict",
      [KnowledgeHttpFixture.Stale],
      HttpStatus.Conflict,
    ),
    rejected(
      "missing entry reports not found",
      [KnowledgeHttpFixture.Missing],
      HttpStatus.NotFound,
    ),
    rejected(
      "persona deletion requires human approval",
      [KnowledgeHttpFixture.Persona],
      HttpStatus.Forbidden,
    ),
  ],
};
