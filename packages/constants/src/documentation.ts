export const PackageReadme = {
  File: "README.md",
  Title: "# ",
  HeadingPattern: /^#{1,6}\s/,
  Sections: ["## Responsibilities", "## Public contract", "## Verification", "## Limits"],
} as const;

export enum ReadmeFinding {
  Missing = "missing-readme",
  Title = "package-title",
  Sections = "required-sections",
  EmptySection = "empty-section",
}
