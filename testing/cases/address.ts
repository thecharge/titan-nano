import { negative, positive } from "@titan/test-factories";
import { localAddress } from "../factories/address.ts";

export const addressCases = {
  positive: [
    positive("loopback server", [localAddress()], localAddress()),
    positive(
      "different port and process",
      [localAddress({ url: "http://127.0.0.1:7777", pid: 23 })],
      localAddress({ url: "http://127.0.0.1:7777", pid: 23 }),
    ),
  ],
  negative: [
    negative(
      "remote host cannot receive local credentials",
      [localAddress({ url: "http://example.invalid:5555" })],
      { name: "ZodError" },
    ),
    negative(
      "URL user information is forbidden",
      [localAddress({ url: "http://user@127.0.0.1:5555" })],
      { name: "ZodError" },
    ),
    negative("short token", [localAddress({ token: "short" })], { name: "ZodError" }),
    negative("negative PID", [localAddress({ pid: -1 })], { name: "ZodError" }),
    negative(
      "query cannot redirect the route",
      [localAddress({ url: "http://127.0.0.1:5555/?target=remote" })],
      { name: "ZodError" },
    ),
  ],
};
