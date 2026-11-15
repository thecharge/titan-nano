import {
  GitChangeKind,
  GitFileMode,
  GitLocalRefPattern,
  GitObjectPattern,
  GitRefPattern,
  HookDocumentation,
  HookGlob,
  HookInvocation,
  HookJob,
  HookLimit,
  HookMode,
  HookName,
  HookPackagePattern,
  HookPreset,
  HookWorkspacePattern,
  PathPart,
} from "@titan/constants";
import { z } from "zod";

export const CiPolicySchema = z.array(z.never());

export const GitObjectSchema = z.string().regex(GitObjectPattern);
export const HookChangeHeaderSchema = z.tuple([
  z.enum(GitFileMode),
  z.enum(GitFileMode),
  GitObjectSchema,
  GitObjectSchema,
  z.enum(GitChangeKind),
]);
export const HookChangeSchema = z
  .strictObject({
    path: z
      .string()
      .min(1)
      .regex(HookDocumentation.PathPattern)
      .refine((path) =>
        path
          .split(PathPart.Separator)
          .every(
            (part) => part.length > 0 && part !== PathPart.Parent && part !== PathPart.Current,
          ),
      ),
    old_mode: z.enum(GitFileMode),
    new_mode: z.enum(GitFileMode),
    kind: z.enum(GitChangeKind),
  })
  .refine((change) => {
    if (change.kind === GitChangeKind.Added)
      return change.old_mode === GitFileMode.Absent && change.new_mode !== GitFileMode.Absent;
    if (change.kind === GitChangeKind.Deleted)
      return change.old_mode !== GitFileMode.Absent && change.new_mode === GitFileMode.Absent;
    return change.old_mode !== GitFileMode.Absent && change.new_mode !== GitFileMode.Absent;
  });
export type HookChange = z.infer<typeof HookChangeSchema>;
export const HookChangesSchema = z.array(HookChangeSchema).max(HookLimit.ChangedFiles);

export const RunWrittenFilesSchema = z.array(z.string());
export type RunWrittenFiles = z.infer<typeof RunWrittenFilesSchema>;

export const GitPushUpdateSchema = z.strictObject({
  localRef: z.string().regex(GitLocalRefPattern),
  localObject: GitObjectSchema,
  remoteRef: z.string().regex(GitRefPattern),
  remoteObject: GitObjectSchema,
});
export type GitPushUpdate = z.infer<typeof GitPushUpdateSchema>;

const hookWorkspaces = z.object({
  packages: z.array(z.string().regex(HookWorkspacePattern)).default([]),
  catalog: z.record(z.string(), z.string()).default({}),
});

export const HookManifestSchema = z.object({
  name: z.string().regex(HookPackagePattern),
  version: z.string().optional(),
  packageManager: z.string().optional(),
  dependencies: z.record(z.string().regex(HookPackagePattern), z.string()).default({}),
  devDependencies: z.record(z.string().regex(HookPackagePattern), z.string()).default({}),
  workspaces: hookWorkspaces.optional(),
});
export type HookManifest = z.infer<typeof HookManifestSchema>;

export const HookRequestSchema = z.strictObject({ mode: z.enum(HookMode) });
export type HookRequest = z.infer<typeof HookRequestSchema>;

export const HookProcessOptionsSchema = z.strictObject({
  cwd: z.string(),
  raw: z.boolean().optional(),
  environment: z.record(z.string(), z.string().optional()).optional(),
});
export type HookProcessOptions = z.infer<typeof HookProcessOptionsSchema>;

export const HookWorkspaceSchema = z.strictObject({
  directory: z.string(),
  manifest: HookManifestSchema,
});
export type HookWorkspace = z.infer<typeof HookWorkspaceSchema>;

const commitHook = z.strictObject({
  jobs: z.tuple([
    z.strictObject({
      name: z.literal(HookJob.FormatCode),
      run: z.literal(HookInvocation.FormatCode),
      glob: z.literal(HookGlob.Code),
      stage_fixed: z.literal(true),
    }),
    z.strictObject({
      name: z.literal(HookJob.FormatDocs),
      run: z.literal(HookInvocation.FormatDocs),
      glob: z.literal(HookGlob.Documents),
      stage_fixed: z.literal(true),
    }),
    z.strictObject({ name: z.literal(HookJob.Commit), run: z.literal(HookInvocation.Commit) }),
  ]),
});
const messageHook = z.strictObject({
  jobs: z.tuple([
    z.strictObject({
      name: z.literal(HookJob.Message),
      run: z.literal(HookInvocation.Message),
    }),
  ]),
});
const pushHook = z.strictObject({
  jobs: z.tuple([
    z.strictObject({
      name: z.literal(HookJob.Push),
      run: z.literal(HookInvocation.Push),
      use_stdin: z.literal(true),
    }),
  ]),
});
export const HookPolicySchema = z.strictObject({
  [HookName.PreCommit]: commitHook,
  [HookName.CommitMessage]: messageHook,
  [HookName.PrePush]: pushHook,
});
export const SecretPolicySchema = z.strictObject({
  rules: z.tuple([z.strictObject({ id: z.literal(HookPreset.Secrets) })]),
});
export const CommitPolicySchema = z.strictObject({
  extends: z.tuple([z.literal(HookPreset.Commitlint)]),
});
