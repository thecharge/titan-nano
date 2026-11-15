import { positive, rejected } from "@titan/test-factories";

const completed = {
  ownerFailed: false,
  ownerCompleted: true,
  peerCompleted: true,
  ownerMatched: true,
  peerMatched: true,
  stopped: true,
  timedOut: false,
};
const cancelled = { ...completed, ownerFailed: true, ownerCompleted: false };
export const codexRoleCases = {
  positive: [
    positive("new and resumed roles remain separate", [false, false], completed),
    positive("quoted and multiline roles retain reversed identity", [false, true], completed),
  ],
  negative: [
    rejected("cancellation cannot replace the peer role", [true, false], cancelled),
    rejected("reversed cancellation cannot replace the peer role", [true, true], cancelled),
  ],
};
