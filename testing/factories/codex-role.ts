import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CodexBackend } from "@titan/backend-codex";
import { VendorStubMode } from "@titan/constants";
import { all } from "@titan/core";
import { observeVendorSession } from "@titan/test-factories";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function codexRole(cancel: boolean, reverse: boolean) {
  return withTemporaryDirectory(async (root) => {
    const first = join(root, "first");
    const second = join(root, "second");
    await all([() => mkdir(first), () => mkdir(second)]);
    const executable = join(import.meta.dir, "../fixtures/vendors/codex-0.171.0.mjs");
    const backend = new CodexBackend(undefined, { executable });
    const roles = [
      'Transport contract role: worker "quoted"\nfeatures.hooks=true',
      "Transport contract role: checker\\path\nKeep results independent",
    ];
    if (reverse) roles.reverse();
    const [owner, peer] = await all([
      () =>
        observeVendorSession(
          backend,
          first,
          false,
          cancel ? VendorStubMode.Cancel : VendorStubMode.Complete,
          undefined,
          undefined,
          roles[0],
        ),
      () =>
        observeVendorSession(
          backend,
          second,
          true,
          VendorStubMode.Complete,
          undefined,
          undefined,
          roles[1],
        ),
    ]);
    return {
      ownerFailed: owner.failed,
      ownerCompleted: owner.correctAnswer,
      peerCompleted: peer.correctAnswer,
      ownerMatched: owner.requestMatched && owner.identityMatched,
      peerMatched: peer.requestMatched && peer.identityMatched,
      stopped: owner.stopped && peer.stopped,
      timedOut: owner.timedOut || peer.timedOut,
    };
  });
}
