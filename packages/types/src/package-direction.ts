import { PackageArchitecture } from "@titan/constants";
import { z } from "zod";
import { exactStringList } from "./validation.ts";

export const PackageArchitectureRootSchema = z.object({
  workspaces: z.object({ packages: exactStringList(PackageArchitecture.WorkspacePatterns) }),
});
