import { test } from "bun:test";
import {
  guardAllowsFakeAgent,
  guardAllowsLoopback,
  guardBlocksAgentPrograms,
  guardBlocksNodeNetwork,
  guardBlocksShellEscape,
  guardBlocksUnknownHost,
  guardBlocksVendorFetch,
  guardRemovesKeys,
  isolatedChildProcess,
  isolatedDefaultProcess,
  isolatedGitHook,
} from "../factories/isolation.ts";

test(
  "default process exposes only loopback and strips inherited vendor credentials",
  isolatedDefaultProcess,
);
test("unmodified child Bun inherits OS denial while loopback remains usable", isolatedChildProcess);
test("Git hooks inherit the same boundary and can reach only the loopback fake", isolatedGitHook);
test("test-strategy > Keys set, no real call: guard removes every key variable", guardRemovesKeys);
test("test-strategy > A vendor API is blocked", guardBlocksVendorFetch);
test("test-strategy > node:https is blocked", guardBlocksNodeNetwork);
test("test-strategy > a connection without a host is blocked", guardBlocksUnknownHost);
test("test-strategy > The real agent program is blocked", guardBlocksAgentPrograms);
test("test-strategy > A shell cannot get around the list", guardBlocksShellEscape);
test("test-strategy > Local server allowed", guardAllowsLoopback);
test("test-strategy > Fake agent program allowed", guardAllowsFakeAgent);
