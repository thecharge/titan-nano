import { unit } from "@titan/test-factories";
import { serverSecondCases } from "../cases/server-second.ts";
import { serverSecond } from "../factories/server-startup.ts";

unit(serverSecond, serverSecondCases);
