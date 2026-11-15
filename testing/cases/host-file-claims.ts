import { AgentHost, KnowledgeFile } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const leases = [
  AgentHost.AdmissionLease,
  AgentHost.Lease,
  AgentHost.ScopeCatalogue,
  `${AgentHost.ClaimsDirectory}/0.db`,
];

export const hostFileLeaseGuardCases = {
  positive: leases.map((lease) =>
    positive(
      `regular lease admission remains available for ${lease}`,
      [lease, "", "regular"],
      true,
    ),
  ),
  negative: leases.flatMap((lease) =>
    KnowledgeFile.SqliteSidecars.flatMap((suffix) =>
      ["symbolic", "hard", "directory"].map((mode) =>
        rejected(
          `${mode} lease path is refused before SQLite admission for ${lease}${suffix}`,
          [lease, suffix, mode],
          true,
        ),
      ),
    ),
  ),
};

export const hostFileClaimsCases = {
  positive: [
    positive("independent leaves share the same project", ["independent"], true),
    positive("writers may share read-only dependencies", ["mixed-independent"], true),
    positive("a reader shares a writer's dependency claim", ["mixed-read"], true),
    positive("overlapping readers share the same project", ["readers"], true),
    positive("parent and child readers overlap", ["parent-read"], true),
    positive("a whole-project reader shares with a child reader", ["root-read"], true),
  ],
  negative: [
    rejected("overlapping writers retain the existing fence", ["same"], true),
    rejected("a later writer conflicts with a retained read dependency", ["mixed-write"], true),
    rejected("a parent writer conflicts with a retained read dependency", ["mixed-parent"], true),
    rejected("a later dependency reader conflicts with an earlier writer", ["mixed-later"], true),
    rejected("a root dependency conflicts with an independent writer", ["mixed-root"], true),
    rejected("a parent writer conflicts with a leaf writer", ["parent-write"], true),
    rejected("a leaf writer conflicts with a parent writer", ["child-write"], true),
    rejected("a parent reader fences a descendant writer", ["parent-reader"], true),
    rejected("a descendant writer fences a later parent reader", ["later-parent-reader"], true),
    rejected("a descendant reader fences a later parent writer", ["child-reader"], true),
    rejected("a parent writer fences a later descendant reader", ["later-child-reader"], true),
    rejected("a whole-project reader fences a descendant writer", ["root-reader"], true),
    rejected("legacy unscoped admission retains whole-project exclusion", ["unscoped"], true),
    rejected("a project alias cannot split the owner fence", ["alias"], true),
  ],
};

export const hostFilePathGuardCases = {
  positive: [
    positive("regular first project supports claims", ["independent"], true),
    positive("regular second project supports shared readers", ["readers"], true),
  ],
  negative: [
    rejected("a linked owner directory is refused", ["root"], true),
    rejected("a linked claim directory is refused", ["claims"], true),
  ],
};

export const hostFileRecoveryCases = {
  positive: [
    positive(
      "graceful release admits a replacement while its peer survives",
      [false, "one.txt"],
      true,
    ),
    positive("a second graceful scope releases independently", [false, "src/two.txt"], true),
  ],
  negative: [
    rejected("a killed scope owner releases only its own fence", [true, "one.txt"], true),
    rejected("a killed nested scope retains its surviving peer fence", [true, "src/two.txt"], true),
  ],
};

export const hostFileBoundsCases = {
  positive: [
    positive("a regular scope fits the retained lease budget", ["regular"], true),
    positive("overlapping input paths retain their strongest claim", ["overlapping-input"], true),
    positive("a full inactive lease directory reuses a retained slot", ["new-claim-budget"], true),
  ],
  negative: [
    rejected("input paths cannot exceed their claim budget", ["scope-budget"], true),
    rejected("invalid paths cannot escape the claim root", ["invalid-path"], true),
    rejected("hard-linked lock files cannot share ownership", ["hard-link"], true),
    rejected("unknown retained claim files are refused", ["unknown-file"], true),
    rejected("a retained directory cannot exceed its budget", ["directory-budget"], true),
    rejected(
      "a corrupt catalogue cannot be treated as an empty board",
      ["catalogue-corrupt"],
      true,
    ),
    rejected("a corrupt retained owner cannot be treated as a dead lease", ["owner-corrupt"], true),
    rejected(
      "a malformed claim record cannot be treated as a dead owner",
      ["record-corrupt"],
      true,
    ),
  ],
};
