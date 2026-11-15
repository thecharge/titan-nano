import { ServerStartCheck, ServerStartupFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverStartsCases = {
  positive: [
    positive("address file has mode 600", [ServerStartCheck.AddressMode], "600"),
    positive("person token file has mode 600", [ServerStartCheck.PersonMode], "600"),
    positive(
      "address file holds the port and the agent token",
      [ServerStartCheck.Content],
      "true true",
    ),
    positive("server listens on 127.0.0.1", [ServerStartCheck.Loopback], "127.0.0.1"),
  ],
  negative: [
    rejected(
      "another loopback address does not answer",
      [ServerStartCheck.OtherLoopback],
      ServerStartupFixture.Refused,
    ),
    rejected(
      "the IPv6 loopback address does not answer",
      [ServerStartCheck.Ipv6],
      ServerStartupFixture.Refused,
    ),
    rejected(
      "group and other users have no access to either file",
      [ServerStartCheck.GroupOther],
      "0 0",
    ),
  ],
};
