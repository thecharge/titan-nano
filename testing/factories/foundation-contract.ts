import { expect } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { resolveConfig } from "@titan/config";
import { CliCommand } from "@titan/constants";
import type { TypeScriptConfig } from "@titan/types";
import { ConfigSchema } from "@titan/types";
import { validateWorkflow, workflowJsonSchema } from "@titan/workflow";
import { commands } from "../../apps/cli/src/main.ts";

const roots: string[] = [];
async function temporary(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "titan-test-"));
  roots.push(path);
  return path;
}
const personas = {
  writer: { description: "Writes", role: "Solve" },
  skeptic: { description: "Checks", role: "Refute" },
};
const step = (id: string) => ({
  id,
  do: { persona: "writer", task: "Solve" },
  falsify: [{ persona: "skeptic", task: "Refute" }],
});
const workflow = () => ({
  name: "Example",
  goal: "A concrete result",
  personas,
  steps: [step("a")],
});
export const foundationContractCleanup = async () => {
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true });
};
export const foundationCommandInventory = () => {
  expect(commands.toSorted()).toEqual(Object.values(CliCommand).toSorted());
  expect(new Set(commands).size).toBe(Object.values(CliCommand).length);
};
export const foundationConfigLimits = () => {
  expect(ConfigSchema.parse({}).limits.max_parallel).toBe(4);
  expect(ConfigSchema.parse({}).server.max_active_agents).toBe(8);
  expect(() => ConfigSchema.parse({ limits: { max_parallel: 0 } })).toThrow();
  expect(() => ConfigSchema.parse({ defaults: { candidates: 2 } })).toThrow();
  expect(() => ConfigSchema.parse({ recovery: { base_delay_s: 3, max_delay_s: 1 } })).toThrow();
};
export const foundationLayeredSettings = async () => {
  const home = await temporary();
  const project = await temporary();
  await writeFile(resolve(home, "config.yaml"), "limits: {max_steps: 7, max_parallel: 3}\n");
  const plan = validateWorkflow({ ...workflow(), limits: { max_parallel: 2 } });
  const result = await resolveConfig({
    home,
    project,
    workflow: { limits: plan.workflow.limits },
  });
  expect(result.value.limits.max_steps).toBe(7);
  expect(result.value.limits.max_parallel).toBe(2);
  expect(result.sources["limits.max_steps"]).toHaveLength(2);
  expect(
    (await resolveConfig({ home, project, overrides: { limits: { max_parallel: 1 } } })).value
      .limits.max_parallel,
  ).toBe(1);
  await expect(
    resolveConfig({ home, project, workflow: { server: { max_active_agents: 50 } } }),
  ).rejects.toThrow("home owner");
  await mkdir(resolve(project, ".titan"));
  await writeFile(resolve(project, ".titan/config.yaml"), "unknown: 1");
  await expect(resolveConfig({ home, project })).rejects.toThrow("unknown");
};
export const foundationMixedDependencies = () => {
  const plan = validateWorkflow({
    ...workflow(),
    steps: [
      step("a"),
      { parallel: [step("b"), { sequential: [step("c"), step("d")] }] },
      step("e"),
    ],
  });
  expect(plan.nodes.map((node) => [node.id, node.needs])).toEqual([
    ["a", []],
    ["b", ["a"]],
    ["c", ["a"]],
    ["d", ["c"]],
    ["e", ["b", "d"]],
  ]);
  expect(workflowJsonSchema().$defs).toBeDefined();
};
export const foundationUnorderedGraph = () => {
  const plan = validateWorkflow({
    name: "DAG",
    goal: "Result",
    personas,
    graph: {
      nodes: [
        { ...step("b"), needs: ["a"] },
        { ...step("a"), needs: [] },
      ],
    },
  });
  expect(plan.nodes[0]?.needs).toEqual(["a"]);
};
export const foundationInvalidDependencies = () => {
  for (const nodes of [
    [{ ...step("a"), needs: ["a"] }],
    [{ ...step("a"), needs: ["missing"] }],
    [
      { ...step("a"), needs: [] },
      { ...step("a"), needs: [] },
    ],
  ])
    expect(() =>
      validateWorkflow({ name: "DAG", goal: "Result", personas, graph: { nodes } }),
    ).toThrow();
};
export const foundationInvalidWorkflow = () => {
  const value = workflow();
  expect(() => validateWorkflow({ ...value, goal: undefined })).toThrow("goal");
  expect(() => validateWorkflow({ ...value, future_option: true })).toThrow();
  expect(() => validateWorkflow({ ...value, steps: [{ ...step("a"), falsify: [] }] })).toThrow();
  expect(() =>
    validateWorkflow({
      ...value,
      steps: [{ ...step("a"), do: { persona: "skeptic", task: "Self-check" } }],
    }),
  ).toThrow("own persona");
  expect(() =>
    validateWorkflow({
      ...value,
      steps: [{ ...step("a"), do: { persona: "missing", task: "Missing" } }],
    }),
  ).toThrow("unknown persona");
};
export const foundationSiblingInputs = () => {
  expect(() =>
    validateWorkflow({
      ...workflow(),
      steps: [{ parallel: [step("a"), { ...step("b"), inputs: { source: "a.note" } }] }],
    }),
  ).toThrow("finished dependency");
};
export const foundationGroupDepth = () => {
  expect(() =>
    validateWorkflow({ ...workflow(), steps: [{ sequential: [{ parallel: [step("a")] }] }] }, 1),
  ).toThrow("nesting");
};
export const foundationFormatMismatch = () => {
  const custom = {
    writer: {
      ...personas.writer,
      inputs: { source: { type: "string" } },
      outputs: { note: { type: "array", items: { type: "string" } } },
    },
    skeptic: personas.skeptic,
  };
  expect(() =>
    validateWorkflow({
      ...workflow(),
      personas: custom,
      steps: [step("a"), { ...step("b"), inputs: { source: "a.note" } }],
    }),
  ).toThrow("different format");
};
export const foundationStrictWorkspaces = async () => {
  const root = JSON.parse(await readFile("tsconfig.json", "utf8")) as TypeScriptConfig;
  for (const key of ["strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes"])
    expect(root.compilerOptions?.[key]).toBe(true);
  for await (const path of new Bun.Glob("{apps,packages}/*/tsconfig.json").scan(".")) {
    const config = JSON.parse(await readFile(path, "utf8")) as TypeScriptConfig;
    expect(config.extends).toBe("../../tsconfig.json");
    for (const key of ["strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes"])
      expect(config.compilerOptions?.[key]).not.toBe(false);
  }
};
