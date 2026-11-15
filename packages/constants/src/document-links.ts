export const DocumentLinkPolicy = {
  Roots: ["docs", "openspec", "apps", "packages", "testing", "tooling"],
  Excluded: ["node_modules", "dist", "coverage"],
  Extensions: [".md"],
  Scheme: /^[a-z][a-z0-9+.-]*:/i,
  AllowedSchemes: ["https:", "http:", "mailto:"],
  NullByte: "\0",
  Fragment: "#",
  Query: "?",
  Children: "children",
  Heading: "heading",
  Targets: ["link", "image", "definition"],
  MissingLine: 0,
} as const;

export const DocumentLinkLimit = {
  FileBytes: 1024 * 1024,
  TotalBytes: 16 * 1024 * 1024,
  Reads: 4096,
  Nodes: 65536,
  Findings: 1024,
  Entries: 32768,
  Depth: 32,
} as const;
