export enum StoreEviction {
  Reject = "reject",
  LeastRecentlyUsed = "least_recently_used",
}
export const RuntimeLimit = {
  ResidentRuns: 1024,
  PendingOperations: 4096,
} as const;
