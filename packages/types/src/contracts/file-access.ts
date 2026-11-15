import type { FileAccessClaim } from "../file-access.ts";

export interface FileAccessWaiter {
  claim: FileAccessClaim;
  active: boolean;
  start: () => void;
}

export type FileProjectResolver = (project: string) => Promise<string>;

export interface FileAccessAdmission {
  key: string;
  claim: FileAccessClaim;
  waiter: FileAccessWaiter;
  ready: Promise<void>;
  waiting: boolean;
  owners: FileAccessClaim[];
}
