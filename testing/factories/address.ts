import type { Address } from "@titan/types";

export function localAddress(overrides: Partial<Address> = {}): Address {
  return { url: "http://127.0.0.1:5555", token: "x".repeat(64), pid: 1, ...overrides };
}
