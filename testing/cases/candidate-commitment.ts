import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const candidateCommitmentRecoveryCases = {
  positive: [
    positive("legacy root retains sidecar verification", [false, false, true], true),
    positive("legacy parent retains sidecar verification", [true, false, true], true),
    positive("root candidate retains its committed bytes", [false, false], true),
    positive("parent candidate retains its committed bytes", [true, false], true),
  ],
  negative: [
    rejected("legacy root refuses changed bytes with unchanged sidecar", [false, true, true], true),
    rejected(
      "legacy parent refuses changed bytes with unchanged sidecar",
      [true, true, true],
      true,
    ),
    rejected("root bytes and sidecar cannot replace the committed candidate", [false, true], true),
    rejected("parent bytes and sidecar cannot replace the committed candidate", [true, true], true),
  ],
};

export const candidateCommitmentProcessCases = {
  positive: [
    positive("Codex resumes the committed candidate after restart", [Backend.Codex, false], true),
    positive("Claude resumes the committed candidate after restart", [Backend.Claude, false], true),
  ],
  negative: [
    rejected("Codex rejects replacement candidate and sidecar", [Backend.Codex, true], true),
    rejected("Claude rejects replacement candidate and sidecar", [Backend.Claude, true], true),
  ],
};

export const candidateCommitmentPhaseCases = {
  positive: [
    positive("legacy phase can omit its candidate commitment", [undefined], true),
    positive("new candidate commitment is a SHA-256 digest", ["a".repeat(64)], true),
  ],
  negative: [
    rejected("empty candidate commitment is refused", [""], false),
    rejected("malformed candidate commitment is refused", ["z".repeat(64)], false),
  ],
};

export const candidateCommitmentPublicationCases = {
  positive: [
    positive("ordinary candidate retains its digest through publication", [false, false], true),
    positive("executable candidate retains its digest through publication", [true, false], true),
  ],
  negative: [
    rejected("checker cannot replace ordinary candidate and sidecar", [false, true], true),
    rejected("checker cannot replace executable candidate and sidecar", [true, true], true),
  ],
};
