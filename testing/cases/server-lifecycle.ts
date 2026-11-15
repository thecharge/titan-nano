import { positive, rejected } from "@titan/test-factories";

export const serverLifecycleCases = {
  positive: [
    positive("concurrent stop shares cleanup before reacquiring home", ["concurrent"], {
      failed: false,
      lockReleased: true,
      databaseClosed: true,
      listenerClosed: true,
      listenersStarted: 1,
      ownerPreserved: true,
      retryReady: true,
    }),
    positive("repeated stop cannot remove a later owner's files", ["repeated"], {
      failed: false,
      lockReleased: true,
      databaseClosed: true,
      listenerClosed: true,
      listenersStarted: 1,
      ownerPreserved: true,
      retryReady: true,
    }),
  ],
  negative: [
    rejected("invalid startup config releases acquired database and lock", ["config"], {
      failed: true,
      lockReleased: true,
      databaseClosed: true,
      listenerClosed: true,
      listenersStarted: 0,
      ownerPreserved: true,
      retryReady: true,
    }),
    rejected("database open failure releases ownership lock", ["database"], {
      failed: true,
      lockReleased: true,
      databaseClosed: true,
      listenerClosed: true,
      listenersStarted: 0,
      ownerPreserved: true,
      retryReady: true,
    }),
    rejected("address publication failure stops listener and releases ownership", ["address"], {
      failed: true,
      lockReleased: true,
      databaseClosed: true,
      listenerClosed: true,
      listenersStarted: 1,
      ownerPreserved: true,
      retryReady: true,
    }),
  ],
};

export const serverAdmissionCases = {
  positive: [
    positive("idle admission closes once after successful work", ["idle"], true),
    positive("shutdown waits for every admitted operation", ["drain"], true),
  ],
  negative: [
    rejected("closed admission cannot dispatch another operation", ["closed"], true),
    rejected("request capacity refuses excess work before dispatch", ["capacity"], true),
  ],
};

export const serverShutdownCases = {
  positive: [
    positive(
      "admitted submission survives shutdown and rejects a later health request",
      ["GET", false],
      true,
    ),
    positive(
      "admitted submission survives shutdown and rejects a later submission",
      ["POST", false],
      true,
    ),
  ],
  negative: [
    rejected(
      "failed admitted submission drains before a later health request",
      ["GET", true],
      true,
    ),
    rejected("failed admitted submission drains before a later submission", ["POST", true], true),
  ],
};
