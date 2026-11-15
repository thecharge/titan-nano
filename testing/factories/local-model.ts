import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EmbedderName, LocalModelEmbedderName } from "@titan/constants";
import { createCachedEmbedder } from "@titan/embedder-local";
import { KnowledgeHub, localMeaning, selectEmbedder, unavailableEmbedder } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { LocalModelStore } from "@titan/workspace";

import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

const content = Buffer.from("pinned model fixture");
const source = {
  name: "fixture-model",
  folder: "fixture-model",
  revision: "a".repeat(40),
  base: "https://example.invalid/resolve",
  artifacts: [
    {
      file: "config.json",
      bytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    },
  ],
};

export async function modelCache(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    let calls = 0;
    const store = new LocalModelStore(home, source, async (url, options) => {
      expect(url).toBe(`${source.base}/${source.revision}/config.json`);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      calls++;
      if (mode === "http") return new Response("failed", { status: 500 });
      if (mode === "body") return new Response(null, { status: 204 });
      if (mode === "short") return new Response(content.subarray(1));
      if (mode === "long") return new Response(Buffer.concat([content, content]));
      if (mode === "digest") return new Response(Buffer.alloc(content.length, 1));
      return new Response(content);
    });
    if (mode === "parent" || mode === "leaf") {
      const outside = resolve(root, "outside");
      await mkdir(home);
      await mkdir(outside);
      await writeFile(resolve(outside, "protected.txt"), content);
      if (mode === "parent") await symlink(outside, resolve(home, "models"));
      else {
        await mkdir(store.directory, { recursive: true });
        await symlink(resolve(outside, "protected.txt"), resolve(store.directory, "config.json"));
      }
      await expect(store.fetch()).rejects.toThrow();
      expect(calls).toBe(0);
      expect(await readFile(resolve(outside, "protected.txt"))).toEqual(content);
      return true;
    }
    expect((await store.inspect()).ready).toBe(false);
    expect(calls).toBe(0);
    if (mode !== "ready" && mode !== "repair") {
      await expect(store.fetch()).rejects.toThrow();
      expect((await store.inspect()).ready).toBe(false);
      return true;
    }
    expect((await store.fetch()).ready).toBe(true);
    expect(calls).toBe(1);
    if (mode === "repair")
      await writeFile(resolve(store.directory, "config.json"), Buffer.alloc(content.length, 1));
    expect((await store.fetch()).ready).toBe(true);
    expect(calls).toBe(mode === "repair" ? 2 : 1);
    expect(await readFile(resolve(store.directory, "config.json"))).toEqual(content);
    return true;
  });
}

export async function homeModel(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    let loads = 0;
    const embedder = createCachedEmbedder(new LocalModelStore(home, source), async () => {
      loads++;
      if (mode === "loader" && loads === 1) throw new Error("load failed");
      return {
        pipeline: async (_task, model, options) => {
          expect(model).toBe(new LocalModelStore(home, source).directory);
          expect(options).toEqual({ dtype: "q8", local_files_only: true });
          if (mode === "pipeline" && loads === 1) throw new Error("pipeline failed");
          return async () => ({ data: new Float32Array([1, 2]) });
        },
      };
    });
    if (mode === "missing") {
      await expect(embedder.embed("missing")).rejects.toThrow();
      expect(loads).toBe(0);
    }
    await new LocalModelStore(home, source, async () => new Response(content)).fetch();
    if (mode === "loader" || mode === "pipeline")
      await expect(embedder.embed("first")).rejects.toThrow();
    expect(await embedder.embed("one")).toEqual([1, 2]);
    expect(await embedder.embed("two")).toEqual([1, 2]);
    expect(loads).toBe(mode === "loader" || mode === "pipeline" ? 2 : 1);
    expect(embedder.name).toContain(source.revision);
    return true;
  });
}

export function modelSelection(configured: string | undefined, pinned: boolean): string {
  return selectEmbedder(
    [{ name: pinned ? LocalModelEmbedderName : EmbedderName.Local, embed: async () => [] }],
    configured,
  ).name;
}

export async function modelCommand(
  command: string,
  ready: boolean,
  enabled: boolean,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const events: string[] = [];
    const status = {
      name: source.name,
      revision: source.revision,
      directory: home,
      bytes: content.length,
      ready,
      missing: ready ? [] : ["config.json"],
      fetch_command: ["titan", "doctor", "--fetch-model"],
    };
    const main = createCli({
      ...defaultServices,
      cwd: () => home,
      program: () => "/usr/bin/tool",
      launch: async () => 0,
      output: (result) => {
        const model = Reflect.get(Object(result), "model");
        expect(model.ready).toBe(ready || enabled);
        events.push("output");
      },
      inspectModel: async (path) => {
        expect(path).toBe(home);
        events.push("inspect");
        return status;
      },
      fetchModel: async (path) => {
        expect(path).toBe(home);
        events.push("fetch");
        return { ...status, ready: true, missing: [] };
      },
      notice: (text) => {
        defaultServices.notice(text);
        expect(text).toContain(source.name);
        expect(text).toContain(String(content.length));
        events.push("notice");
      },
    });
    const options =
      command === "install"
        ? ["--harness", "claude", ...(enabled ? [] : ["--no-model"])]
        : enabled
          ? ["--fetch-model"]
          : [];
    expect(await main([command, "--home", home, "--project", home, ...options])).toBe(0);
    expect(events).toEqual(
      !ready && enabled ? ["inspect", "notice", "fetch", "output"] : ["inspect", "output"],
    );
    return true;
  });
}

export async function modelReadiness(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const store = new LocalModelStore(home, source, async () => new Response(content));
    if (mode !== "missing") await store.fetch();
    if (mode === "corrupt")
      await writeFile(resolve(store.directory, "config.json"), Buffer.alloc(content.length, 1));
    if (mode === "changed" || mode === "reindexed") {
      const original = await KnowledgeHub.open(
        home,
        {},
        undefined,
        localMeaning(home, { name: "earlier", embed: async () => [1, 2] }),
      );
      await original.close();
    }
    const embedder =
      mode === "unavailable" ? unavailableEmbedder("missing") : createCachedEmbedder(store);
    const hub = await KnowledgeHub.open(home, {}, undefined, localMeaning(home, embedder));
    try {
      expect((await hub.stats()).meaning_ready).toBe(mode === "ready");
      if (mode === "reindexed") {
        await hub.reindex();
        expect((await hub.stats()).meaning_ready).toBe(true);
      }
      return true;
    } finally {
      await hub.close();
    }
  });
}
