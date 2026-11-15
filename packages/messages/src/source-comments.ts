export const sourceCommentReadLimit =
  "Source comment inventory is missing or exceeds its allowance";
export const sourceCommentViolation = (file: string, line: number) =>
  `${file}:${line}: move the source comment rationale into the technical documentation`;
