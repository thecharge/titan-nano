import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { chmod, link, mkdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  CredentialFixture,
  FileEncoding,
  HttpHeader,
  HttpOriginHeader,
  LocalServer,
  RunStatus,
  ServerCredential,
  ServerLimit,
} from "@titan/constants";
import { call, startServer } from "@titan/server";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  AddressSchema,
  PersonTokenSchema,
  RunSnapshotSchema,
  type ServerHandle,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { createFakeBackend } from "../support/backend.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function credentialAccess(mode: CredentialFixture) {
  return withTemporaryDirectory(async (directory) => {
    const home = resolve(directory, "home");
    await mkdir(home);
    const path = resolve(home, ServerCredential.PersonFile);
    const target = resolve(directory, "target");
    const seed = randomBytes(ServerCredential.RandomBytes).toString(FileEncoding.Hex);
    if (mode === CredentialFixture.Linked || mode === CredentialFixture.HardLink) {
      await writeFile(target, Buffer.from(seed), { mode: ServerLimit.FileMode });
      if (mode === CredentialFixture.Linked) await symlink(target, path);
      else await link(target, path);
    }
    if (mode === CredentialFixture.Directory) await mkdir(path);
    if (mode === CredentialFixture.BroadMode) {
      await writeFile(path, Buffer.from(seed), { mode: ServerLimit.FileMode });
      await chmod(path, 0o644);
    }
    if (mode === CredentialFixture.InvalidFile)
      await writeFile(path, Buffer.from("x".repeat(ServerCredential.TokenCharacters)), {
        mode: ServerLimit.FileMode,
      });
    if (mode === CredentialFixture.LargeFile)
      await writeFile(path, Buffer.alloc(ServerCredential.FileBytes + 1), {
        mode: ServerLimit.FileMode,
      });
    if (mode === CredentialFixture.LineEnding)
      await writeFile(path, Buffer.from(`${seed}\n`), { mode: ServerLimit.FileMode });
    const factory = () => createFakeBackend();
    let server: ServerHandle;
    try {
      server = await startServer(home, factory);
    } catch (error) {
      assert.equal(await exists(resolve(home, LocalServer.File)), false);
      if (mode === CredentialFixture.Linked || mode === CredentialFixture.HardLink)
        assert.equal(
          (await readFileBytes(target, ServerCredential.FileBytes)).toString(FileEncoding.Utf8),
          seed,
        );
      await rm(path, { recursive: true, force: true });
      const repaired = await startServer(home, factory);
      await repaired.stop();
      throw error;
    }
    try {
      const readPerson = async () =>
        PersonTokenSchema.parse(
          (await readFileBytes(path, ServerCredential.FileBytes)).toString(FileEncoding.Utf8),
        );
      const person = await readPerson();
      assert.ok(person !== server.address.token);
      assert.equal((await stat(path)).mode & ServerCredential.ModeMask, ServerLimit.FileMode);
      const addressPath = resolve(home, LocalServer.File);
      assert.equal(
        (await stat(addressPath)).mode & ServerCredential.ModeMask,
        ServerLimit.FileMode,
      );
      const publicAddress = AddressSchema.parse(
        JSON.parse(
          (await readFileBytes(addressPath, ServerCredential.FileBytes * 4)).toString(
            FileEncoding.Utf8,
          ),
        ),
      );
      assert.equal(publicAddress.token, server.address.token);
      if (mode === CredentialFixture.Reuse) {
        const timestamp = (await stat(path)).mtimeMs;
        const previousAgent = server.address.token;
        await server.stop();
        server = await startServer(home, factory);
        assert.equal(await readPerson(), person);
        assert.equal((await stat(path)).mtimeMs, timestamp);
        assert.ok(server.address.token !== previousAgent);
      }
      if (
        [CredentialFixture.Fresh, CredentialFixture.Human, CredentialFixture.Reuse].includes(mode)
      ) {
        const project = resolve(directory, "project");
        await mkdir(project);
        const run = RunSnapshotSchema.parse(
          await call(home, "/runs", "POST", {
            project,
            workflow: checkedWorkflow(),
            backend: Backend.Fake,
            client_id: "credentials",
            submission_id: "checked",
          }),
        );
        assert.ok(
          await waitUntil(
            async () =>
              RunSnapshotSchema.parse(await call(home, `/runs/${run.run_id}`)).state ===
              RunStatus.Passed,
          ),
        );
      }
      const human = mode === CredentialFixture.Human || mode === CredentialFixture.OriginHuman;
      const headers = new Headers({
        [HttpHeader.Authorization]: LocalServer.Bearer + (human ? person : server.address.token),
      });
      if (mode === CredentialFixture.NoToken) headers.delete(HttpHeader.Authorization);
      if (mode === CredentialFixture.InvalidToken)
        headers.set(HttpHeader.Authorization, LocalServer.Bearer + seed);
      if (mode === CredentialFixture.OriginAgent || mode === CredentialFixture.OriginHuman)
        headers.set(HttpOriginHeader, "https://example.com");
      const response = await fetch(`${server.address.url}/health`, { headers });
      const content = (await readFileBytes(addressPath, ServerCredential.FileBytes * 4)).toString(
        FileEncoding.Utf8,
      );
      assert.equal(content.includes(person), false);
      await response.body?.cancel();
      return response.status;
    } finally {
      await server.stop();
      assert.equal(await exists(path), true);
    }
  });
}
