import { PathPart, WorkspaceExcluded, WorkspaceFile, WorkspacePathPattern } from "@titan/constants";
import { z } from "zod";

export const WorkspaceEntryNameSchema = z
  .string()
  .regex(WorkspacePathPattern)
  .refine(
    (name) =>
      name !== PathPart.Current &&
      name !== PathPart.Parent &&
      !name.includes(PathPart.Separator) &&
      !name.includes(PathPart.Backslash) &&
      !WorkspaceExcluded.includes(name) &&
      name !== WorkspaceFile.Environment &&
      !name.startsWith(WorkspaceFile.EnvironmentPrefix),
  );

export const WorkspacePathSchema = z.string().regex(WorkspacePathPattern);

export const WorkspaceRelativePathSchema = WorkspacePathSchema.refine((path) =>
  path.split(PathPart.Separator).every((part) => WorkspaceEntryNameSchema.safeParse(part).success),
);
