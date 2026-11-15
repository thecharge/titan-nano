export const ImprovedFile = {
  Extension: ".yaml",
  VersionMark: ".v",
  FirstSaved: 2,
  Digits: /^\d+$/,
  Utf8: "utf8",
  ExclusiveFlag: "wx",
} as const;

export const ImprovedFixture = {
  Name: "plan",
  Other: "other",
  Kept: "name: kept\n",
  Separator: " ",
} as const;
