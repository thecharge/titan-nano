import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const attemptInputRecoveryCases = {
  positive: [
    positive("root worker resumes with verified input", [false, false, false], true),
    positive("root checker keeps its completed worker", [true, false, false], true),
    positive("dependent worker retains verified parent files", [false, true, false], true),
    positive(
      "dependent checker retains its completed parent and worker",
      [true, true, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "missing root input blocks before worker continuation",
      [false, false, true, true],
      true,
    ),
    rejected(
      "missing dependent input blocks before checker continuation",
      [true, true, true, true],
      true,
    ),
    rejected("changed root input blocks before worker continuation", [false, false, true], true),
    rejected("changed root input blocks before checker continuation", [true, false, true], true),
    rejected(
      "changed inherited input blocks before worker continuation",
      [false, true, true],
      true,
    ),
    rejected(
      "changed inherited input blocks before checker continuation",
      [true, true, true],
      true,
    ),
  ],
};

export const attemptInputProcessCases = {
  positive: [
    positive(
      "Codex resumes from intact saved input after daemon loss",
      [Backend.Codex, false],
      true,
    ),
    positive(
      "Claude resumes from intact saved input after daemon loss",
      [Backend.Claude, false],
      true,
    ),
  ],
  negative: [
    rejected("Codex refuses changed saved input before native resume", [Backend.Codex, true], true),
    rejected(
      "Claude refuses changed saved input before native resume",
      [Backend.Claude, true],
      true,
    ),
  ],
};

export const attemptInputPublicationCases = {
  positive: [
    positive("worker retains original publication input", [false, false], true),
    positive("checker retains original publication input", [true, false], true),
  ],
  negative: [
    rejected("worker cannot change input used to derive delivered changes", [false, true], true),
    rejected("checker cannot change input used to derive delivered changes", [true, true], true),
  ],
};

export const attemptInputAdmissionCases = {
  positive: [
    positive("available capacity checks interrupted worker input", [false, false], true),
    positive("available capacity checks interrupted checker input", [true, false], true),
  ],
  negative: [
    rejected("busy owner refuses worker input reads before admission", [false, true], true),
    rejected("busy owner refuses checker input reads before admission", [true, true], true),
  ],
};
