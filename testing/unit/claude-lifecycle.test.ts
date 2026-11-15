import { unit } from "@titan/test-factories";
import { claudeStreamLifecycleCases } from "../cases/claude-lifecycle.ts";
import { claudeStreamLifecycle } from "../factories/claude-lifecycle.ts";

unit(claudeStreamLifecycle, claudeStreamLifecycleCases);
