import { expect } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  DashboardHeader,
  DashboardRoute,
  DashboardSession,
  KnowledgeKind,
  KnowledgeScope,
  KnowledgeState,
  RunStatus,
  ServerCredential,
} from "@titan/constants";
import { inspectKnowledge, KnowledgeHub, projectHubHome } from "@titan/knowledge";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type DashboardCodeBody, DashboardKnowledgeSchema } from "@titan/types";
import { schemaFakeAnswer } from "../support/backend.ts";
import { knowledgeDraft } from "./knowledge.ts";
import { knowledgeAttemptScope } from "./knowledge-attempts.ts";

export async function dashboardKnowledge(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const home = join(root, "home");
    const project = join(root, "project");
    await mkdir(project);
    const shared = await KnowledgeHub.open(home);
    const homeEntry = await shared.add({
      ...knowledgeDraft(KnowledgeKind.Fact),
      title: "Shared fact",
    });
    await shared.close();
    const local = await KnowledgeHub.open(projectHubHome(project));
    const projectEntry = await local.add({
      ...knowledgeDraft(KnowledgeKind.Lesson),
      title: "Project lesson",
    });
    await local.add({ ...knowledgeDraft(KnowledgeKind.Fact), title: "Project fact" });
    const pendingOwner = knowledgeAttemptScope();
    const pendingId = "00000000-0000-4000-8000-000000000009";
    await local.attempts.stage(pendingOwner, {
      revision: null,
      mutations: [{ id: pendingId, version: null, entry: knowledgeDraft(KnowledgeKind.Fact) }],
    });
    await local.close();
    const server = await startServer(home, () => new FakeBackend(schemaFakeAnswer));
    try {
      const client = createRunClient(home);
      const run = await client.submit({
        workflow: vendorRecoveryWorkflow(),
        project,
        backend: Backend.Fake,
        client_id: "knowledge-dashboard",
        submission_id: "one",
        workflow_path: "workflow.yaml",
      });
      expect(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed),
      ).toBe(true);
      const person = (await readFile(join(home, ServerCredential.PersonFile), "utf8")).trim();
      const minted = await fetch(server.address.url + DashboardRoute.Code, {
        method: "POST",
        headers: { authorization: `Bearer ${person}` },
      });
      const code = ((await minted.json()) as DashboardCodeBody).code;
      const login = await fetch(
        server.address.url +
          DashboardRoute.Login +
          "?" +
          DashboardSession.CodeParameter +
          "=" +
          code,
        { redirect: "manual" },
      );
      const cookie = login.headers.get(DashboardHeader.SetCookie)?.split(";")[0] ?? "";
      const query = new URLSearchParams();
      if (mode !== "home" && mode !== "home-entry")
        query.set("run_id", mode === "unknown" ? "unknown-run" : run.run_id);
      if (mode === "entry") query.set("id", projectEntry.entry.id);
      if (mode === "home-entry" || mode === "home-scope-entry") {
        query.set("id", homeEntry.entry.id);
        query.set("scope", KnowledgeScope.Home);
      }
      if (mode === "scope") {
        query.set("scope", KnowledgeScope.Project);
        query.set("kind", KnowledgeKind.Lesson);
      }
      if (mode === "tag") {
        query.set("scope", KnowledgeScope.Project);
        query.set("tag", "clock");
      }
      if (mode === "missing-tag") query.set("tag", "absent-tag");
      if (mode === "invalid") query.set("scope", "invalid-scope");
      if (mode === "unknown-field") query.set("project_path", "/etc");
      if (mode === "pending" || mode === "pending-home") {
        query.set("state", KnowledgeState.Pending);
        query.set("scope", mode === "pending" ? KnowledgeScope.Project : KnowledgeScope.Home);
      }
      if (mode === "invalid-state") query.set("state", "wrong-state");
      if (mode === "pending-entry") {
        query.set("state", KnowledgeState.Pending);
        query.set("id", projectEntry.entry.id);
      }
      const before = [
        (await (await inspectKnowledge(home)).stats()).never_read,
        (await (await inspectKnowledge(projectHubHome(project))).stats()).never_read,
      ];
      const headers = new Headers({ cookie });
      if (mode === "origin") headers.set("origin", "https://example.com");
      if (mode === "cookie") headers.delete("cookie");
      const suffix = mode === "duplicate" ? "&run_id=other" : "";
      const response = await fetch(
        `${server.address.url + DashboardRoute.Knowledge}?${query}${suffix}`,
        { method: mode === "post" ? "POST" : "GET", headers },
      );
      if (
        mode === "origin" ||
        mode === "cookie" ||
        mode === "post" ||
        mode === "duplicate" ||
        mode === "unknown" ||
        mode === "invalid" ||
        mode === "unknown-field" ||
        mode === "invalid-state" ||
        mode === "pending-entry"
      ) {
        const status =
          mode === "origin" ? 403 : mode === "cookie" ? 401 : mode === "post" ? 405 : 400;
        expect(response.status).toBe(status);
        return true;
      }
      expect(response.status).toBe(200);
      const data = DashboardKnowledgeSchema.parse(await response.json());
      expect([
        (await (await inspectKnowledge(home)).stats()).never_read,
        (await (await inspectKnowledge(projectHubHome(project))).stats()).never_read,
      ]).toEqual(before);
      if (mode === "pending" || mode === "pending-home") {
        expect(data.list.entries.length).toBe(mode === "pending" ? 1 : 0);
        if (mode === "pending") {
          expect(data.list.entries[0]?.attempt).toEqual(pendingOwner);
          expect(data.list.entries[0]?.id).toBe(pendingId);
          expect(data.list.entries[0]?.state).toBe(KnowledgeState.Pending);
        }
        return true;
      }
      const homeOnly = mode === "home" || mode === "home-entry" || mode === "home-scope-entry";
      const selected = mode === "scope" || mode === "tag";
      if (mode === "missing-tag") expect(data.list.entries).toEqual([]);
      else {
        expect(
          data.list.entries.some(
            (entry) => entry.id === homeEntry.entry.id && entry.scope === KnowledgeScope.Home,
          ),
        ).toBe(!selected);
        expect(data.list.entries.some((entry) => entry.id === projectEntry.entry.id)).toBe(
          !homeOnly,
        );
      }
      if (selected)
        expect(data.list.entries.every((entry) => entry.scope === KnowledgeScope.Project)).toBe(
          true,
        );
      if (mode === "scope")
        expect(data.list.entries.every((entry) => entry.kind === KnowledgeKind.Lesson)).toBe(true);
      if (mode === "tag")
        expect(data.list.entries.every((entry) => entry.tags.includes("clock"))).toBe(true);
      expect(data.stats.scopes.length).toBe(homeOnly || selected ? 1 : 2);
      const projectStats = data.stats.scopes.find(
        (entry) => entry.scope === KnowledgeScope.Project,
      );
      if (projectStats) {
        expect(
          projectStats.kinds.find((entry) => entry.kind === KnowledgeKind.Lesson)?.entries,
        ).toBe(3);
        expect(projectStats.kinds.find((entry) => entry.kind === KnowledgeKind.Fact)?.entries).toBe(
          1,
        );
        expect(projectStats.oldest).not.toBeNull();
        expect(projectStats.newest).not.toBeNull();
      }
      expect(data.stats.meaning_ready).toBe(false);
      expect(data.entry?.entry.id ?? null).toBe(
        mode === "entry"
          ? projectEntry.entry.id
          : mode === "home-entry" || mode === "home-scope-entry"
            ? homeEntry.entry.id
            : null,
      );
      if (mode === "entry") {
        expect(data.entry?.scope).toBe(KnowledgeScope.Project);
        expect(data.entry?.entry.body).toBe(projectEntry.entry.body);
      }
      if (mode === "home-entry" || mode === "home-scope-entry")
        expect(data.entry?.scope).toBe(KnowledgeScope.Home);
      return true;
    } finally {
      await server.stop();
    }
  });
}
