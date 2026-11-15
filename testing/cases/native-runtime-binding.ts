import { Backend, NativeToolRole, NativeToolTransport } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeRuntimeBindingCases = {
  positive: [
    positive(
      "HTTP Codex worker uses scoped tools across resume",
      [Backend.Codex, NativeToolRole.Worker, false, false, NativeToolTransport.Http],
      true,
    ),
    positive(
      "HTTP Claude checker uses scoped tools across resume",
      [Backend.Claude, NativeToolRole.Checker, false, false, NativeToolTransport.Http],
      true,
    ),
    positive(
      "HTTP hosted Codex checker receives runtime readiness",
      [Backend.Codex, NativeToolRole.Checker, true, false, NativeToolTransport.Http],
      true,
    ),
    positive(
      "HTTP hosted Claude worker receives runtime readiness",
      [Backend.Claude, NativeToolRole.Worker, true, false, NativeToolTransport.Http],
      true,
    ),
    positive(
      "Codex worker uses native tools before and after resume",
      [Backend.Codex, NativeToolRole.Worker, false, false],
      true,
    ),
    positive(
      "Codex checker uses its read-only inventory",
      [Backend.Codex, NativeToolRole.Checker, false, false],
      true,
    ),
    positive(
      "Claude worker waits for the native server before its task",
      [Backend.Claude, NativeToolRole.Worker, false, false],
      true,
    ),
    positive(
      "Claude checker retains native tools across resume",
      [Backend.Claude, NativeToolRole.Checker, false, false],
      true,
    ),
    positive(
      "hosted Codex worker receives its volatile binding",
      [Backend.Codex, NativeToolRole.Worker, true, false],
      true,
    ),
    positive(
      "hosted Claude worker receives its volatile binding",
      [Backend.Claude, NativeToolRole.Worker, true, false],
      true,
    ),
    positive(
      "hosted Codex checker retains its scoped inventory",
      [Backend.Codex, NativeToolRole.Checker, true, false],
      true,
    ),
    positive(
      "hosted Claude checker retains its scoped inventory",
      [Backend.Claude, NativeToolRole.Checker, true, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "HTTP Codex refuses forged execution before vendor delivery",
      [Backend.Codex, NativeToolRole.Worker, false, true, NativeToolTransport.Http],
      true,
    ),
    rejected(
      "HTTP Claude refuses forged execution before vendor delivery",
      [Backend.Claude, NativeToolRole.Checker, false, true, NativeToolTransport.Http],
      true,
    ),
    rejected(
      "HTTP hosted Codex refuses substituted scope",
      [Backend.Codex, NativeToolRole.Checker, true, true, NativeToolTransport.Http],
      true,
    ),
    rejected(
      "HTTP hosted Claude refuses substituted scope",
      [Backend.Claude, NativeToolRole.Worker, true, true, NativeToolTransport.Http],
      true,
    ),
    rejected(
      "HTTP Codex refuses absent runtime readiness",
      [Backend.Codex, NativeToolRole.Worker, false, false, NativeToolTransport.Http, false],
      true,
    ),
    rejected(
      "HTTP Claude refuses absent runtime readiness",
      [Backend.Claude, NativeToolRole.Checker, false, false, NativeToolTransport.Http, false],
      true,
    ),
    rejected(
      "Codex forged execution cannot deliver a task",
      [Backend.Codex, NativeToolRole.Worker, false, true],
      true,
    ),
    rejected(
      "Claude forged execution cannot deliver a task",
      [Backend.Claude, NativeToolRole.Checker, false, true],
      true,
    ),
    rejected(
      "hosted Codex refuses substituted scope",
      [Backend.Codex, NativeToolRole.Checker, true, true],
      true,
    ),
    rejected(
      "hosted Claude refuses substituted scope",
      [Backend.Claude, NativeToolRole.Worker, true, true],
      true,
    ),
  ],
};
