import { strict as assert } from "node:assert";
import { FakeBackend } from "@titan/backend-fake";
import { agentSpec } from "@titan/test-factories";

export async function fakeDefault(explicit: boolean, resume: boolean, admission: boolean) {
  let called = 0;
  let events = 0;
  const backend = new FakeBackend(
    explicit
      ? async () => {
          called++;
          return { json: { ok: true } };
        }
      : undefined,
  );
  const spec = agentSpec("/tmp");
  const prompt = JSON.stringify({ task: "other" });
  const session = resume ? await backend.resume("retained", spec) : await backend.start(spec);
  try {
    if (admission) {
      await backend.validateTurn(spec, prompt);
      return { answer: null, events, called };
    }
    const answer = await session.send(
      prompt,
      async () => {
        events++;
      },
      new AbortController().signal,
    );
    if (resume) assert.equal(answer.session_id, "retained");
    return { answer: answer.json, events, called };
  } finally {
    await session.close();
  }
}
