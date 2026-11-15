import { positive, rejected } from "@titan/test-factories";
export const pendingInspectionCases = {
  positive: [
    positive("open additions and updates retain private provenance", ["normal"], true),
    positive("pending deletion is visible without recording a read", ["delete"], true),
    positive("prepared publication remains visible", ["prepared"], true),
    positive("kind selection keeps only matching drafts", ["kind"], true),
    positive("temporary writer file is not parsed", ["temporary"], true),
  ],
  negative: [
    rejected("discarded attempts are absent", ["discarded"], true),
    rejected("published attempts are absent", ["published"], true),
    rejected("missing tag has no pending matches", ["tag"], true),
    rejected("page limit reports truncation", ["limit"], true),
    rejected("linked attempt is refused", ["linked"], true),
    rejected("crossed attempt path is refused", ["crossed"], true),
    rejected("malformed document is refused", ["invalid"], true),
    rejected("unknown extension is refused", ["extension"], true),
    rejected("subdirectory is refused", ["directory"], true),
    rejected("directory scan budget is enforced", ["capacity"], true),
    rejected("mutation count budget is enforced", ["entries"], true),
    rejected("document byte budget is enforced", ["bytes"], true),
  ],
};
export const pendingScopeCases = {
  positive: [
    positive("pending project filter retains both candidates", ["scoped"], true),
    positive("CLI project list retains attempt provenance", ["cli"], true),
    positive("CLI home list retains attempt provenance", ["cli-home"], true),
  ],
  negative: [
    rejected("missing pending directory is not created", ["missing"], true),
    rejected("empty home is not changed", ["empty"], true),
    rejected("pending root file is refused", ["root-file"], true),
    rejected("pending root symlink is refused", ["root-link"], true),
    rejected("combined pending page reports overflow", ["limited"], true),
    rejected("missing pending provider fails explicitly", ["unavailable"], true),
  ],
};
