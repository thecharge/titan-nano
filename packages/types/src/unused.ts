import {
  UnusedConfiguration,
  UnusedFixture,
  UnusedToolBindings,
  UnusedWorkspace,
} from "@titan/constants";
import { z } from "zod";
import { exactStringList } from "./validation.ts";

const workspaces = UnusedConfiguration.workspaces;
const project = z.strictObject({
  project: exactStringList(workspaces[UnusedWorkspace.Apps].project),
});
const rootWorkspace = z.strictObject({
  entry: exactStringList(workspaces[UnusedWorkspace.Root].entry),
  project: exactStringList(workspaces[UnusedWorkspace.Root].project),
  ignoreDependencies: exactStringList(workspaces[UnusedWorkspace.Root].ignoreDependencies),
});
const testingWorkspace = z.strictObject({
  entry: exactStringList(workspaces.testing.entry),
  project: exactStringList(workspaces.testing.project),
});
const workspaceConfiguration = z.strictObject({
  ".": rootWorkspace,
  "apps/*": project,
  "packages/*": project,
  testing: testingWorkspace,
  "testing/packages/*": project,
});
export const UnusedConfigurationSchema = z.strictObject({ workspaces: workspaceConfiguration });

export const UnusedToolBindingsSchema = z
  .array(z.strictObject({ dependency: z.string(), used: z.literal(true) }))
  .refine(
    (bindings) =>
      exactStringList(UnusedToolBindings.map((binding) => binding.dependency)).safeParse(
        bindings.map((binding) => binding.dependency),
      ).success,
  );
export const UnusedFixtureSchema = z.enum(UnusedFixture);
