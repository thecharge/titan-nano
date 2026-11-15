export const serialCollapseText = (kind: string, narrow: number, total: number): string =>
  `serial collapse for ${kind}: ${narrow} of ${total} splits of 4 or more parts ran with width 1`;

export const emptyAgentsText = (kind: string, empty: number, started: number): string =>
  `empty agents for ${kind}: ${empty} of ${started} agents had no part`;
