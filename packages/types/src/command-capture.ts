import { CommandCaptureLimit, ProofAnswer } from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema } from "./artifacts.ts";
import { WorkspaceRelativePathSchema } from "./workspace-path.ts";

export const CaptureCommandSchema = z
  .array(
    z
      .string()
      .max(CommandCaptureLimit.ArgumentCharacters)
      .regex(CommandCaptureLimit.ArgumentPattern),
  )
  .min(1)
  .max(CommandCaptureLimit.Arguments)
  .refine((command) => (command[0]?.length ?? 0) > 0)
  .refine(
    (command) =>
      command.reduce((total, argument) => total + argument.length, 0) <=
      CommandCaptureLimit.TotalCharacters,
  );

export const CommandCaptureOptionsSchema = z.strictObject({
  maximum_bytes: z
    .int()
    .positive()
    .max(CommandCaptureLimit.Bytes)
    .default(CommandCaptureLimit.Bytes),
  timeout_ms: z
    .int()
    .positive()
    .max(CommandCaptureLimit.MaximumMilliseconds)
    .default(CommandCaptureLimit.DefaultMilliseconds),
});
export type CommandCaptureOptions = z.input<typeof CommandCaptureOptionsSchema>;

export const CommandCaptureSchema = z.strictObject({
  exit_code: z.int().nonnegative(),
  stdout: z.instanceof(Buffer),
  stderr: z.instanceof(Buffer),
});
export type CommandCapture = z.infer<typeof CommandCaptureSchema>;

export const SavedCommandCaptureSchema = CommandCaptureSchema.extend({
  stdout: z.string(),
  stderr: z.string(),
  stdout_base64: z.string().base64().optional(),
  stderr_base64: z.string().base64().optional(),
  elapsed_ms: z.int().nonnegative().optional(),
  capture: z
    .strictObject({ path: WorkspaceRelativePathSchema, hash: ArtifactHashSchema })
    .optional(),
});

export type SavedCommandCapture = z.infer<typeof SavedCommandCaptureSchema>;

export const ScriptCaptureOutputSchema = z.strictObject({
  command: z.string(),
  captures: z.array(SavedCommandCaptureSchema),
});

export const ScriptCheckAnswerSchema = z.strictObject({
  answer: z.enum(ProofAnswer),
  evidence: z.string(),
});
export type ScriptCheckAnswer = z.infer<typeof ScriptCheckAnswerSchema>;
