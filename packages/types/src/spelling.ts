import { SpellingConfiguration, SpellingPolicy } from "@titan/constants";
import { z } from "zod";
import { exactStringList } from "./validation.ts";

export const SpellingLimitsSchema = z.strictObject({
  batch_files: z
    .number()
    .int()
    .positive()
    .max(SpellingPolicy.MaximumFiles)
    .default(SpellingPolicy.MaximumFiles),
  batch_bytes: z
    .number()
    .int()
    .positive()
    .max(SpellingPolicy.BatchBytes)
    .default(SpellingPolicy.BatchBytes),
});
export type SpellingLimits = z.infer<typeof SpellingLimitsSchema>;

export const SpellingConfigurationSchema = z.strictObject({
  version: z.literal(SpellingConfiguration.version),
  language: z.literal(SpellingConfiguration.language),
  useGitignore: z.literal(false),
  validateDirectives: z.literal(true),
  allowCompoundWords: z.literal(false),
  maxFileSize: z.literal(SpellingConfiguration.maxFileSize),
  files: exactStringList(SpellingConfiguration.files),
  ignorePaths: exactStringList(SpellingConfiguration.ignorePaths),
  words: exactStringList(SpellingConfiguration.words),
  overrides: z
    .array(z.strictObject({ filename: z.array(z.string()), words: z.array(z.string()) }))
    .refine((actual) => JSON.stringify(actual) === JSON.stringify(SpellingConfiguration.overrides)),
});
