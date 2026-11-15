import { strict as assert } from "node:assert";
import { readRunConfiguration } from "@titan/config";
import {
  CliCommand,
  DashboardHeader,
  DashboardHtmlSource,
  DashboardPolicy,
  DashboardProbe,
  DashboardRoute,
  DashboardSession,
  HttpStatus,
} from "@titan/constants";
import {
  ArtifactInspectionSchema,
  ArtifactPageSchema,
  DashboardLoginSchema,
  DashboardRunListSchema,
  DashboardRunSchema,
  type PackageProbeCommand,
  type Run,
} from "@titan/types";

export async function probeDashboard(command: PackageProbeCommand, run: Run): Promise<void> {
  const { link } = DashboardLoginSchema.parse(await command([CliCommand.Dashboard]));
  const origin = new URL(link).origin;
  const login = await fetch(link, { redirect: DashboardProbe.Redirect });
  assert.equal(login.status, HttpStatus.SeeOther);
  const cookie = login.headers
    .get(DashboardHeader.SetCookie)
    ?.split(DashboardSession.CookieSeparator)[0];
  assert.ok(cookie);
  const headers = { [DashboardHeader.Cookie]: cookie };
  assert.equal(
    (await fetch(link, { redirect: DashboardProbe.Redirect })).status,
    HttpStatus.Forbidden,
  );
  assert.equal((await fetch(origin + DashboardRoute.Runs)).status, HttpStatus.Unauthorized);
  const page = await fetch(origin + DashboardRoute.Page, { headers });
  assert.equal(page.status, HttpStatus.Ok);
  assert.equal(
    page.headers.get(DashboardHeader.ContentSecurityPolicy),
    DashboardPolicy.ContentSecurityPolicy,
  );
  const assets = [...(await page.text()).matchAll(DashboardHtmlSource.SourcePattern)];
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    const path = asset[1];
    assert.ok(path && DashboardRoute.AssetPattern.test(path));
    const response = await fetch(origin + path, { headers });
    assert.equal(response.status, HttpStatus.Ok);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  assert.ok(run.harness_session_id);
  const query = new URLSearchParams({
    client_id: run.client_id,
    harness_session_id: run.harness_session_id,
    project_path: run.project,
    limit: String(1),
  });
  const listed = DashboardRunListSchema.parse(
    await (
      await fetch(origin + DashboardRoute.Runs + DashboardRoute.Query + query, { headers })
    ).json(),
  );
  assert.deepEqual(
    listed.runs.map((entry) => entry.summary.run_id),
    [run.run_id],
  );
  assert.equal(listed.page?.has_more, false);
  assert.equal(listed.capacity?.active, 0);
  assert.equal(listed.capacity?.pending, 0);
  assert.ok((listed.capacity?.max_active_agents ?? 0) > 0);
  const detail = DashboardRunSchema.parse(
    await (
      await fetch(origin + DashboardRoute.RunPrefix + encodeURIComponent(run.run_id), { headers })
    ).json(),
  );
  assert.equal(detail.context?.project, run.project);
  assert.equal(detail.context?.backend, run.backend);
  assert.equal(detail.context?.max_parallel, run.config.value.limits.max_parallel);
  assert.equal(detail.numbers.run_id, run.run_id);
  assert.equal(detail.steps.length, run.plan.nodes.length);
  assert.deepEqual(
    detail.steps.map((step) => step.needs),
    run.plan.nodes.map((step) => step.needs),
  );
  assert.ok(detail.steps.every((step) => step.recovery?.length === 0));
  const configurationPath =
    origin +
    DashboardRoute.RunPrefix +
    encodeURIComponent(run.run_id) +
    DashboardRoute.ConfigurationSuffix;
  assert.equal((await fetch(configurationPath)).status, HttpStatus.Unauthorized);
  const configuration = readRunConfiguration(
    await (await fetch(configurationPath, { headers })).json(),
    run.run_id,
  );
  assert.deepEqual(configuration.config, run.config);
  assert.equal(configuration.workflow_revision, run.workflow_revision);
  assert.equal(
    (await fetch(configurationPath + DashboardProbe.InvalidConfigurationQuery, { headers })).status,
    HttpStatus.BadRequest,
  );
  const artifactsPath =
    origin +
    DashboardRoute.RunPrefix +
    encodeURIComponent(run.run_id) +
    DashboardRoute.ArtifactsSuffix;
  assert.equal((await fetch(artifactsPath)).status, HttpStatus.Unauthorized);
  const inspection = ArtifactInspectionSchema.parse(
    await (await fetch(artifactsPath, { headers })).json(),
  );
  assert.equal(inspection.run_id, run.run_id);
  for (const file of inspection.files.slice(0, 1)) {
    const page = ArtifactPageSchema.parse(
      await (await fetch(artifactsPath + DashboardRoute.Page + file.id, { headers })).json(),
    );
    assert.equal(page.file.hash, file.hash);
    assert.equal(page.offset, 0);
    assert.ok(page.next_offset <= file.bytes);
  }
  for (const invalid of DashboardProbe.InvalidQueries)
    assert.equal(
      (await fetch(origin + DashboardRoute.Runs + DashboardRoute.Query + invalid, { headers }))
        .status,
      HttpStatus.BadRequest,
    );
  console.log(
    JSON.stringify({
      installed_dashboard: true,
      assets: assets.length,
      steps: detail.steps.length,
    }),
  );
}
