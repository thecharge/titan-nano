import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { Verdict } from "@titan/constants";
import { startServer } from "@titan/server";

const [home, retry] = process.argv.slice(2);
if (!home) throw new Error("Missing temporary test home");
const server = await startServer(
  home,
  () =>
    new FakeBackend(async (spec) => {
      if (!spec.writable) return { json: { verdict: Verdict.Survived, evidence: "checked" } };
      await writeFile(
        resolve(spec.cwd, "note.txt"),
        retry === "true" && spec.attempt === 1 ? "bad" : "good",
      );
      return { json: { ok: true } };
    }),
);
process.once("SIGTERM", () => {
  void server.stop().then(() => process.exit(0));
});
