import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { nativeToolConnection, nativeToolEnvironment } from "@titan/config/native-tools";
import {
  ErrorCode,
  HttpHeader,
  KnowledgeKind,
  KnowledgeSearchMode,
  KnowledgeState,
  KnowledgeTool,
  LocalServer,
  McpIdentity,
  NativeTool,
  NativeToolBearerReference,
  NativeToolEnvironment,
  NativeToolPolicy,
  NativeToolRole,
  NativeToolTransport,
  ServerLimit,
} from "@titan/constants";
import { uuidFromText } from "@titan/core";

export { claudeNativeEvents, codexNativeEvents } from "./native-events.mjs";

export function codexNativeConfiguration(args) {
  const prefix = `mcp_servers.${NativeTool.Name}.`;
  const settings = Object.fromEntries(
    args
      .filter((arg) => arg.startsWith(prefix))
      .map((arg) => {
        const split = arg.indexOf("=");
        return [arg.slice(prefix.length, split), JSON.parse(arg.slice(split + 1))];
      }),
  );
  if (Object.keys(settings).length === 0) return undefined;
  const connection = nativeToolConnection();
  assert.equal(settings.required, true);
  assert.equal(settings.startup_readiness, "connection");
  assert.equal(settings.startup_timeout_sec, connection.timeout_ms / 1000);
  assert.equal(settings.tool_timeout_sec, connection.timeout_ms / 1000);
  assert.deepEqual(settings.enabled_tools, [...NativeToolPolicy[connection.scope.role]]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(settings).filter(([key]) => key.startsWith("tools."))),
    Object.fromEntries(
      NativeToolPolicy[connection.scope.role].map((tool) => [
        `tools.${tool}.approval_mode`,
        "approve",
      ]),
    ),
  );
  assert.equal(settings.default_tools_approval_mode, undefined);
  if (settings.url !== undefined) {
    assert.equal(settings.url, connection.url);
    assert.equal(settings.bearer_token_env_var, NativeToolEnvironment.Token);
    assert.equal(settings.command, undefined);
    assert.equal(settings.args, undefined);
    assert.equal(settings.env_vars, undefined);
    return {
      type: NativeToolTransport.Http,
      url: settings.url,
      bearer_token_env_var: settings.bearer_token_env_var,
    };
  }
  assert.deepEqual(settings.env_vars, Object.values(NativeToolEnvironment));
  assert.equal(settings.bearer_token_env_var, undefined);
  return { command: settings.command, args: settings.args };
}

export async function vendorNativeTools(configuration, args, resources) {
  if (!configuration) return undefined;
  const connection = nativeToolConnection();
  assert.equal(
    args.some((arg) => arg.includes(connection.token)),
    false,
  );
  assert.equal(configuration.env, undefined);
  let transport;
  if (configuration.type === NativeToolTransport.Http) {
    assert.equal(configuration.url, connection.url);
    assert.equal(configuration.command, undefined);
    assert.equal(configuration.args, undefined);
    if (configuration.bearer_token_env_var !== undefined) {
      assert.equal(configuration.bearer_token_env_var, NativeToolEnvironment.Token);
      assert.equal(configuration.headers, undefined);
    } else {
      assert.deepEqual(configuration.headers, {
        [HttpHeader.Authorization]: NativeToolBearerReference,
      });
    }
    const headers = { [HttpHeader.Authorization]: LocalServer.Bearer + connection.token };
    transport = new StreamableHTTPClientTransport(new URL(configuration.url), {
      requestInit: { headers },
    });
  } else {
    assert.equal(configuration.url, undefined);
    assert.equal(configuration.headers, undefined);
    transport = new StdioClientTransport({
      command: configuration.command,
      args: configuration.args,
      env: nativeToolEnvironment(connection),
      stderr: "inherit",
      maxBufferSize: ServerLimit.RequestBytes,
    });
  }
  const client = new Client({ name: McpIdentity.Name, version: McpIdentity.Version });
  resources.defer(() => client.close());
  await client.connect(transport, { timeout: connection.timeout_ms });
  const listed = await client.listTools();
  assert.deepEqual(
    new Set(listed.tools.map((tool) => tool.name)),
    new Set(NativeToolPolicy[connection.scope.role]),
  );
  let result;
  return {
    get result() {
      return result;
    },
    status: [
      {
        name: NativeTool.Name,
        status: "connected",
        tools: listed.tools.map((tool) => ({ name: tool.name, description: tool.description })),
      },
    ],
    async verifySkills(role) {
      assert.ok(
        role.includes("Available workspace skills:") && role.includes("- linked: Synthetic review"),
      );
      assert.ok(role.includes("Use the synthetic reference."));
      if (role.includes("Read the synthetic generated file.")) {
        const cache = await client.callTool({
          name: NativeTool.ReadFile,
          arguments: { path: ".cache/generated.txt" },
        });
        assert.equal(cache.isError === true, false, JSON.stringify(cache));
        assert.equal(
          Buffer.from(JSON.parse(cache.content[0].text).content, "base64").toString(),
          "Explicit managed cache read.",
        );
      }
      const prefix = "@titan-skills/linked/references/";
      const read = await client.callTool({
        name: NativeTool.ReadFile,
        arguments: { path: prefix + "alias.md" },
      });
      assert.equal(read.isError === true, false, JSON.stringify(read));
      assert.equal(
        Buffer.from(JSON.parse(read.content[0].text).content, "base64").toString(),
        "Synthetic reference.",
      );
      const escapedRead = await client.callTool({
        name: NativeTool.ReadFile,
        arguments: { path: prefix + "escape.md" },
      });
      assert.equal(escapedRead.isError, true, JSON.stringify(escapedRead));
    },
    async executeSplit() {
      assert.equal(connection.scope.role, NativeToolRole.Worker);
      const file = await client.callTool({
        name: NativeTool.ReadFile,
        arguments: { path: "source.txt" },
      });
      assert.equal(file.isError === true, false, JSON.stringify(file));
      const observed = JSON.parse(file.content[0].text);
      assert.equal(observed.observation.path, "source.txt");
      assert.equal(typeof observed.observation.version, "string");
      assert.equal(typeof observed.content, "string");
      const search = await client.callTool({
        name: KnowledgeTool.Search,
        arguments: { kind: KnowledgeKind.Fact },
      });
      assert.equal(search.isError === true, false, JSON.stringify(search));
    },
    async executeWebRead(answered) {
      const url = "https://127.0.0.1/";
      const decision = answered?.answer?.decision;
      const call = async (value, request_id) => {
        const reply = await client.callTool({
          name: NativeTool.ReadWeb,
          arguments: { url: value, request_id },
        });
        assert.equal(reply.isError === true, false, JSON.stringify(reply));
        return JSON.parse(reply.content[0].text);
      };
      const different = await call("https://127.0.0.1/other");
      assert.equal(different.request.scope.resource, "https://127.0.0.1/other");
      if (answered) {
        const mismatched = await client.callTool({
          name: NativeTool.ReadWeb,
          arguments: { url: "https://127.0.0.1/other", request_id: answered.request_id },
        });
        assert.equal(mismatched.isError, true);
      }
      const result = await call(url, answered?.request_id);
      if (decision === "approve") {
        assert.equal(result.requested, url);
        assert.match(result.error, /public addresses/);
      } else if (decision === "deny") {
        assert.deepEqual(result, { decision });
      } else {
        assert.equal(result.request.kind, "resource");
        assert.equal(result.request.scope.operation, "web_read");
        assert.equal(result.request.scope.resource, url);
      }
    },
    async executeFileWrite(writable, refusedScope) {
      const read = await client.callTool({
        name: NativeTool.ReadFile,
        arguments: { path: "source.txt" },
      });
      assert.equal(read.isError === true, false, JSON.stringify(read));
      const observed = JSON.parse(read.content[0].text);
      assert.equal(
        Buffer.from(observed.content, "base64").toString(),
        writable || refusedScope ? "Original project content" : "Managed native update",
      );
      if (!writable) {
        assert.equal(connection.scope.role, NativeToolRole.Checker);
        assert.equal(
          listed.tools.some((tool) => tool.name === NativeTool.WriteFile),
          false,
        );
        return;
      }
      for (const [path, content, expected_version, refused] of [
        ["source.txt", "Managed native update", observed.observation.version, refusedScope],
        ["created.txt", "Managed native creation", null, false],
        ["outside.txt", "Unapproved", null, true],
        ["source.txt", "Stale overwrite", observed.observation.version, true],
      ]) {
        const changed = await client.callTool({
          name: NativeTool.WriteFile,
          arguments: { path, content, expected_version },
        });
        assert.equal(changed.isError === true, refused, JSON.stringify(changed));
        if (!refused)
          assert.equal(
            Buffer.from(JSON.parse(changed.content[0].text).content, "base64").toString(),
            content,
          );
      }
    },
    async executeWrite() {
      const file = await client.callTool({
        name: NativeTool.ReadFile,
        arguments: { path: "source.txt" },
      });
      assert.equal(file.isError === true, false, JSON.stringify(file));
      const observed = JSON.parse(file.content[0].text);
      assert.equal(
        Buffer.from(observed.content, "base64").toString(),
        "Synthetic observation content.\n".repeat(4096),
      );
      assert.equal(observed.observation.path, "source.txt");
      assert.equal(typeof observed.observation.version, "string");
      const absent = await client.callTool({
        name: NativeTool.ReadFile,
        arguments: { path: "missing-native-read.txt" },
      });
      assert.equal(absent.isError === true, false, JSON.stringify(absent));
      assert.deepEqual(JSON.parse(absent.content[0].text), {
        observation: {
          path: "missing-native-read.txt",
          version: null,
          hash: null,
          executable: null,
        },
        content: null,
      });
      const listed = await client.callTool({
        name: NativeTool.ListFiles,
        arguments: { directory: "." },
      });
      assert.equal(listed.isError === true, false, JSON.stringify(listed));
      const listing = JSON.parse(listed.content[0].text).observation;
      assert.equal(listing.directory, ".");
      assert.equal(listing.files.includes("source.txt"), true);
      assert.equal(
        listing.files.some((path) => path.startsWith(".titan/")),
        false,
      );
      const id = uuidFromText(
        JSON.stringify([connection.scope.run_id, connection.scope.step_id, "native-project"]),
      );
      if (connection.scope.role === NativeToolRole.Worker) {
        const added = await client.callTool({
          name: KnowledgeTool.Add,
          arguments: {
            private_revision: null,
            entry: {
              id,
              kind: KnowledgeKind.Fact,
              title: "Project native proposal",
              body: "Private project knowledge checked before publication",
              tags: [],
            },
          },
        });
        assert.equal(added.isError === true, false, JSON.stringify(added));
        const answer = JSON.parse(added.content[0].text);
        assert.equal(answer.visibility, KnowledgeState.Pending);
        const read = await client.callTool({ name: KnowledgeTool.Get, arguments: { id } });
        assert.equal(read.isError === true, false);
        assert.equal(JSON.parse(read.content[0].text).entry.id, id);
        result = read;
        return;
      }
      const read = await client.callTool({ name: KnowledgeTool.Get, arguments: { id } });
      assert.equal(read.isError, true);
      assert.equal(JSON.parse(read.content[0].text).code, ErrorCode.KnowledgeMissing);
      result = read;
    },
    async execute() {
      const search = await client.callTool({
        name: KnowledgeTool.Search,
        arguments: { question: "time zones", mode: KnowledgeSearchMode.Words },
      });
      assert.equal(search.isError === true, false);
      const page = JSON.parse(search.content[0].text);
      assert.equal(page.results.length, 1);
      const read = await client.callTool({
        name: KnowledgeTool.Get,
        arguments: { id: page.results[0].id },
      });
      assert.equal(read.isError === true, false);
      assert.equal(JSON.stringify(read).includes(connection.token), false);
      result = read;
    },
  };
}
