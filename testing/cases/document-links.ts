import { DocumentLinkMessage, documentLinkInvalid } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const empty = { findings: [], reads: [] };
const heading = { "docs/target.md": { exists: true, markdown: "## Target\n" } };
const space = { "docs/space name.md": { exists: true, markdown: "## Target\n" } };
const asset = { "docs/asset.png": { exists: true } };
const folder = { "docs/folder": { exists: true } };
const outside = { "../outside.md": { exists: true } };
const missing = { findings: [documentLinkInvalid("docs/guide.md", 1)], reads: ["docs/missing.md"] };
const invalid = { findings: [documentLinkInvalid("docs/guide.md", 1)], reads: [] };
const budget = { message: DocumentLinkMessage.Budget };

export const documentLinkSyntaxCases = {
  positive: [
    positive("relative heading target resolves", ["[target](target.md#target)", heading], {
      findings: [],
      reads: ["docs/target.md"],
    }),
    positive(
      "duplicate self headings retain distinct anchors",
      ["# Echo\n# Echo\n[second](#echo-1)"],
      empty,
    ),
    positive(
      "reference definition is inspected",
      ["[target][saved]\n\n[saved]: target.md#target", heading],
      { findings: [], reads: ["docs/target.md"] },
    ),
    positive("image targets resolve", ["![asset](asset.png)", asset], {
      findings: [],
      reads: ["docs/asset.png"],
    }),
    positive(
      "fenced example links are reference text",
      ["```md\n[missing](missing.md)\n```"],
      empty,
    ),
    positive(
      "encoded spaces and queries preserve heading selection",
      ["[target](space%20name.md?view=source#target)", space],
      { findings: [], reads: ["docs/space name.md"] },
    ),
    positive(
      "external URLs and mail addresses require no network work",
      ["[web](https://example.invalid) [mail](mailto:user@example.invalid)"],
      empty,
    ),
    positive("directory target needs no heading", ["[folder](folder)", folder], {
      findings: [],
      reads: ["docs/folder"],
    }),
  ],
  negative: [
    rejected("missing file is refused", ["[missing](missing.md)"], missing),
    rejected("missing heading is refused", ["[missing](target.md#absent)", heading], {
      findings: [documentLinkInvalid("docs/guide.md", 1)],
      reads: ["docs/target.md"],
    }),
    rejected(
      "binary asset cannot supply a Markdown heading",
      ["[asset](asset.png#target)", asset],
      { findings: [documentLinkInvalid("docs/guide.md", 1)], reads: ["docs/asset.png"] },
    ),
    rejected("unapproved scheme is refused without loading", ["[target](javascript:run)"], invalid),
    rejected("network-relative target is refused", ["[target](//example.invalid)"], invalid),
    rejected(
      "parent traversal cannot load an outside target",
      ["[target](../../outside.md)", outside],
      invalid,
    ),
    rejected(
      "encoded traversal cannot load an outside target",
      ["[target](%2e%2e/%2e%2e/outside.md)", outside],
      invalid,
    ),
    rejected("encoded backslash target is refused", ["[target](%5c/missing.md)"], invalid),
    rejected("encoded null target is refused", ["[target](target%00.md)"], invalid),
    rejected("malformed percent target is refused", ["[target](target%QQ.md)"], invalid),
    rejected("unused broken definition is inspected", ["[unused]: missing.md"], missing),
    rejected(
      "loader failure cannot certify a link",
      ["[missing](missing.md)", {}, {}, true],
      missing,
    ),
    negative("source byte limit stops parsing", ["# Guide", {}, { file_bytes: 1 }], budget),
    negative("node inventory cannot exceed its limit", ["# Guide", {}, { nodes: 1 }], budget),
    negative(
      "finding inventory cannot exceed its limit",
      ["[one](missing.md) [two](missing.md)", {}, { findings: 1 }],
      budget,
    ),
  ],
};

const main = { "README.md": "# Guide\n" };
const linked = { "README.md": "[guide](docs/guide.md#guide)", "docs/guide.md": "# Guide\n" };
const missingTarget = { "README.md": "[guide](docs/missing.md)" };
const ignored = {
  ...main,
  "node_modules/vendor/README.md": "[bad](missing.md)",
  "dist/README.md": "[bad](missing.md)",
};
const missingRoot = { "docs/guide.md": "# Guide\n" };
const nested = { ...main, "docs/nested/guide.md": "# Guide\n" };
const passed = { code: 0, findings: [DocumentLinkMessage.Passed] };
const failed = { code: 1, findings: [DocumentLinkMessage.Failed] };
const exhausted = { code: 1, findings: [DocumentLinkMessage.Budget] };

export const documentLinkTreeCases = {
  positive: [
    positive("root guide is checked read-only", [main], passed),
    positive("linked guide and heading are checked", [linked], passed),
    positive("dependencies and generated trees stay outside document ownership", [ignored], passed),
  ],
  negative: [
    rejected("missing root guide cannot certify an empty scope", [missingRoot], failed),
    rejected("missing repository cannot certify an empty scope", [main, {}, true], failed),
    rejected("missing linked file blocks verification", [missingTarget], {
      code: 1,
      findings: [documentLinkInvalid("README.md", 1)],
    }),
    rejected("aggregate reads stay finite", [linked, { reads: 1 }], exhausted),
    rejected("aggregate source bytes stay finite", [linked, { total_bytes: 1 }], failed),
    rejected("directory entry inventory stays finite", [linked, { entries: 1 }], exhausted),
    rejected("directory depth stays finite", [nested, { depth: 1 }], exhausted),
    rejected(
      "aggregate findings stay finite",
      [
        { "README.md": "[missing](missing.md)", "docs/guide.md": "[missing](missing.md)" },
        { findings: 1 },
      ],
      exhausted,
    ),
    rejected("invalid limits cannot certify documents", [main, { reads: 0 }], failed),
  ],
};

export const documentLinkResolvedTargetCases = {
  positive: [
    positive("contained linked file can supply a heading", [false, false], 0),
    positive("contained linked directory can be opened", [false, true], 0),
  ],
  negative: [
    rejected("outside linked file cannot supply a heading", [true, false], 1),
    rejected("outside linked directory cannot be opened", [true, true], 1),
  ],
};

export const documentLinkSourceCases = {
  positive: [
    positive("ordinary root guide is checked", [false, false], 0),
    positive("ordinary guide ignores an outside fixture", [false, true], 0),
  ],
  negative: [
    rejected("linked owned guide cannot disappear from discovery", [true, false], 1),
    rejected("outside linked owned guide cannot disappear from discovery", [true, true], 1),
  ],
};

export const documentLinkEncodingCases = {
  positive: [
    positive("root UTF-8 guide remains unchanged", [false, false], 0),
    positive("secondary UTF-8 guide remains unchanged", [false, true], 0),
  ],
  negative: [
    rejected("invalid root UTF-8 blocks verification", [true, false], 1),
    rejected("invalid secondary UTF-8 blocks verification", [true, true], 1),
  ],
};

export const documentLinkSnapshotCases = {
  positive: [
    positive("valid staged guide ignores an unstaged broken link", [true, false], [0]),
    positive("valid first outgoing guide retains a later broken revision", [true, true], [0, 1]),
  ],
  negative: [
    rejected("unstaged repair cannot hide a broken staged guide", [false, false], [1]),
    rejected("later repair cannot hide an earlier outgoing broken link", [false, true], [1, 0]),
  ],
};
