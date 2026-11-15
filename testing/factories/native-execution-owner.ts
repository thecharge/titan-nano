import { strict as assert } from "node:assert";
import {
  ErrorCode,
  HttpStatus,
  NativeOwnerFixture,
  NativeTool,
  type NativeToolRole,
} from "@titan/constants";
import { KnowledgeHub } from "@titan/knowledge";
import { NativeExecutions } from "@titan/server/native-executions";
import { NativeToolAuthority } from "@titan/server/native-tools";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { acceptNativeAudit } from "./native-audit.ts";
import { nativeBridgeConnection } from "./native-tool-bridge.ts";

export async function nativeExecutionOwner(role: NativeToolRole, mode: NativeOwnerFixture) {
  return withTemporaryDirectory(async (home) => {
    await using resources = new AsyncDisposableStack();
    const hub = await KnowledgeHub.open(home);
    resources.defer(() => hub.close());
    const authority = new NativeToolAuthority(
      hub,
      { max_bindings: 1, max_pending_operations: 1 },
      acceptNativeAudit,
    );
    resources.defer(() => authority.close());
    const input = nativeBridgeConnection(role, home);
    const owner = new NativeExecutions(
      authority,
      () => input.url,
      { command: process.execPath, args: [] },
      1000,
    );
    let current = true;
    const isCurrent = () => current;
    if (mode === NativeOwnerFixture.Directory)
      assert.throws(() => owner.open(input.scope, isCurrent, "relative"), {
        code: ErrorCode.Arguments,
      });
    const execution = owner.open(input.scope, isCurrent, home);
    resources.defer(() => execution.close());
    assert.deepEqual(execution.binding.connection.scope, input.scope);
    assert.equal(execution.binding.connection.run_directory, home);
    const token = execution.binding.connection.token;
    assert.equal(JSON.stringify(execution.binding.launch).includes(token), false);
    await execution.guard({ ordinary: "A bounded ordinary value" });
    execution.scanner().accept(Buffer.from("Ordinary file data"));
    if (mode === NativeOwnerFixture.Value)
      await assert.rejects(execution.guard({ nested: { content: token } }), {
        code: ErrorCode.SecretValue,
      });
    if (mode === NativeOwnerFixture.Chunks) {
      const scanner = execution.scanner();
      scanner.accept(Buffer.from(token.slice(0, 16)));
      assert.throws(() => scanner.accept(Buffer.from(token.slice(16))), {
        code: ErrorCode.SecretValue,
      });
    }
    if (mode === NativeOwnerFixture.Obsolete) {
      current = false;
      const response = await authority.respond(
        new Request(input.url, { headers: { authorization: `Bearer ${token}` } }),
      );
      assert.equal(response.status, HttpStatus.Forbidden);
    }
    await execution.close();
    const response = await authority.respond(
      new Request(input.url, { headers: { authorization: `Bearer ${token}` } }),
    );
    assert.equal(new URL(input.url).pathname, NativeTool.Route);
    assert.equal(response.status, HttpStatus.Forbidden);
    const next = owner.open(input.scope, () => true, home);
    assert.notEqual(next.binding.connection.token, token);
    await next.close();
    return true;
  });
}
