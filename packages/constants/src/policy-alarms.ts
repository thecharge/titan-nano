export const PolicyAlarm = {
  Window: 20,
  MinParts: 4,
  CollapseShare: 0.5,
  Bonus: 0.1,
  EmptyShare: 0.1,
  EmptyMultiplier: 2,
  BaseMultiplier: 1,
  SingleWidth: 1,
  PostKind: "alarm",
  PostTo: "main",
  KindPattern: /^[a-z][a-z0-9-]*$/,
} as const;

export const PolicyAlarmFixture = {
  Code: "code-fix",
  Research: "research",
  Parts: 4,
  Wide: 4,
  KindJson: '"kind":"alarm"',
  SerialText: "serial collapse",
  EmptyText: "empty agents",
  None: "none",
  Digits: 3,
  ShareDigits: 2,
} as const;
