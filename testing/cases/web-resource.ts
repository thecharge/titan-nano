import { positive, rejected } from "@titan/test-factories";

export const webResourceCases = {
  positive: [
    positive("web read retains the public redirect and source digest", ["redirect"], true),
    positive("web read reports unsupported binary extraction", ["binary"], true),
  ],
  negative: [
    rejected("web read refuses private redirect before dialing", ["private"], true),
    rejected("web read stops at the redirect bound", ["loop"], true),
    rejected("web read stops at the response byte bound", ["large"], true),
    rejected("an aborted DNS lookup cannot reach the transport", ["dns-abort"], true),
  ],
};

export const webResourceCliCases = {
  positive: [
    positive("web command records a missing approval request", ["pending"], true),
    positive("owner policy permits a read without a request", ["auto"], true),
  ],
  negative: [
    rejected("web command rejects a request for another URL", ["wrong-url"], true),
    rejected("an approved read still refuses a private address", ["approved"], true),
  ],
};

export const webResourceDialCases = {
  positive: [
    positive("the reader pins the address and verifies the named TLS host", ["named"], true),
    positive("an IP source leaves the TLS server name unset", ["ip"], true),
  ],
  negative: [
    rejected("a connection failure rejects the dial", ["connection"], true),
    rejected("an aborted response stops the stream", ["abort"], true),
  ],
};

export const webResourceNativeCases = {
  positive: [
    positive("the native worker receives a request under review policy", ["request"], true),
    positive("owner policy allows a native call without a request", ["auto"], true),
    positive("a resumed native worker uses the bound approval", ["approve"], true),
  ],
  negative: [
    rejected("the native tool rejects cleartext input", ["cleartext"], true),
    rejected("the native tool rejects an unbound approval", ["unbound"], true),
    rejected("a resumed native worker cannot fetch after denial", ["deny"], true),
  ],
};
