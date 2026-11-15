import { ErrorCode, RuntimeLimit } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { ServerMessage } from "@titan/messages";
import type { AsyncTask } from "@titan/types";

export class ServerAdmission {
  private active: number;
  private closing: PromiseWithResolvers<void> | undefined;

  constructor() {
    this.active = 0;
  }

  get pending(): number {
    return this.active;
  }

  async use<T>(action: AsyncTask<T>): Promise<T> {
    if (this.closing) throw new OperationalError(ErrorCode.ServerStopping, ServerMessage.Stopping);
    if (this.active >= RuntimeLimit.PendingOperations)
      throw new OperationalError(ErrorCode.Capacity, ServerMessage.AdmissionCapacity);
    this.active++;
    try {
      return await action();
    } finally {
      this.release();
    }
  }

  private release(): void {
    this.active--;
    if (!this.active) this.closing?.resolve();
  }

  close(): Promise<void> {
    this.closing ??= Promise.withResolvers<void>();
    if (!this.active) this.closing.resolve();
    return this.closing.promise;
  }
}
