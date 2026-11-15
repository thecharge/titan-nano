export const DocumentLinkMessage = {
  Budget: "Document link verification exceeded its finite inventory or parsing budget",
  Failed: "Document link verification could not inspect its complete scope",
  Passed: "Owned Markdown links and heading targets are valid",
} as const;
export const documentLinkInvalid = (file: string, line: number): string =>
  `${file}:${line} contains an invalid document link`;
