export const fixedApprovalLevel = (kind: string): string =>
  `the level of "${kind}" cannot be lower than human`;
export const workflowApprovalLevel = (kind: string): string =>
  `the workflow file cannot lower the level of "${kind}"`;
export const limitedApprovalLevel = (kind: string): string =>
  `only the home owner can lower the level of "${kind}"`;
