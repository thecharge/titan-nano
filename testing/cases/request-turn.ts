import { Backend, RequestTurnFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestTurnCases = {
  positive: [
    positive(
      "lost worker turn acknowledgement retains one atomic batch after reload",
      [false, true, false, false, Backend.Fake, 1, 256, RequestTurnFixture.LostAck],
      true,
    ),
    positive(
      "lost checker turn acknowledgement retains one atomic batch after reload",
      [true, true, false, false, Backend.Fake, 1, 256, RequestTurnFixture.LostAck],
      true,
    ),
    positive(
      "worker resumes after a complete three-request batch",
      [false, true, true, false, Backend.Fake, 3],
      true,
    ),
    positive(
      "checker resumes after a complete three-request batch",
      [true, true, true, false, Backend.Fake, 3],
      true,
    ),
    positive(
      "worker answer continues the same session without recovery allowance",
      [false, false],
      true,
    ),
    positive(
      "checker answer continues the same session without recovery allowance",
      [true, false],
      true,
    ),
    positive(
      "worker denial survives reload and reaches only its asking phase",
      [false, true],
      true,
    ),
    positive(
      "checker denial survives reload and retains its worker checkpoint",
      [true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "duplicate answered worker resume retains one continuation after reload",
      [false, true, false, false, Backend.Fake, 1, 256, RequestTurnFixture.ResumeAdmission],
      true,
    ),
    rejected(
      "duplicate answered checker resume retains one continuation after reload",
      [true, true, false, false, Backend.Fake, 1, 256, RequestTurnFixture.ResumeAdmission],
      true,
    ),
    rejected(
      "unanswered caller worker cannot downgrade its format",
      [false, true, true, false, Backend.Fake, 1, 256, RequestTurnFixture.None, "outer-worker"],
      true,
    ),
    rejected(
      "caller checker write refusal cannot downgrade its format",
      [
        true,
        false,
        false,
        false,
        Backend.Fake,
        1,
        256,
        RequestTurnFixture.WriteAdmission,
        "outer-checker",
      ],
      true,
    ),
    rejected(
      "worker waiting origin cannot reopen during continuation validation",
      [false, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.ResumeAdmission],
      true,
    ),
    rejected(
      "checker waiting origin cannot reopen during continuation validation",
      [true, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.ResumeAdmission],
      true,
    ),
    rejected(
      "oversized worker journal admission restores its pending turn and format",
      [false, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.WriteAdmission],
      true,
    ),
    rejected(
      "oversized checker journal admission restores its pending turn and format",
      [true, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.WriteAdmission],
      true,
    ),
    rejected(
      "forged worker request turn origin fails replay",
      [false, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.ForgedOrigin],
      true,
    ),
    rejected(
      "forged checker request turn origin fails replay",
      [true, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.ForgedOrigin],
      true,
    ),
    rejected(
      "worker pending membership cannot omit its atomic request",
      [false, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.MissingMember],
      true,
    ),
    rejected(
      "checker pending membership cannot omit its atomic request",
      [true, false, false, false, Backend.Fake, 1, 256, RequestTurnFixture.MissingMember],
      true,
    ),
    rejected(
      "worker batch exceeding its frozen allowance publishes no partial request",
      [false, false, false, false, Backend.Fake, 2, 1],
      true,
    ),
    rejected(
      "checker batch exceeding its frozen allowance publishes no partial request",
      [true, false, false, false, Backend.Fake, 2, 1],
      true,
    ),
    rejected("unanswered worker cannot spend a turn on resume", [false, true, true], true),
    rejected("unanswered checker cannot spend a turn on resume", [true, true, true], true),
    rejected(
      "worker cannot deliver a result while requesting a wait",
      [false, false, false, true],
      true,
    ),
    rejected(
      "checker cannot deliver a verdict while requesting a wait",
      [true, false, false, true],
      true,
    ),
  ],
};
