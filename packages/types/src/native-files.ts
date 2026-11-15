import {
  ConfigDefault,
  NativeFileLimit,
  PathPart,
  Sha256Pattern,
  TextSymbol,
} from "@titan/constants";
import { z } from "zod";
import { WorkspaceRelativePathSchema } from "./workspace-path.ts";

export const NativeFileSelectionSchema = z.strictObject({ path: WorkspaceRelativePathSchema });
export const NativeFileObservationSchema = z.union([
  NativeFileSelectionSchema.extend({
    version: z.string().min(1).max(NativeFileLimit.VersionCharacters),
    hash: z.string().regex(Sha256Pattern),
    executable: z.boolean(),
  }),
  NativeFileSelectionSchema.extend({
    version: z.null(),
    hash: z.null(),
    executable: z.null(),
  }),
]);
export type NativeFileObservation = z.infer<typeof NativeFileObservationSchema>;
export const NativeFileListSelectionSchema = z.strictObject({
  directory: z.union([z.literal(PathPart.Current), WorkspaceRelativePathSchema]),
});
export const NativeFileListingSchema = NativeFileListSelectionSchema.extend({
  files: z.array(WorkspaceRelativePathSchema).max(ConfigDefault.MaxWorkspaceEntriesLimit),
}).refine((listing) =>
  listing.files.every(
    (path, index) =>
      (index === 0 || (listing.files[index - 1] ?? TextSymbol.Empty).localeCompare(path) < 0) &&
      (listing.directory === PathPart.Current ||
        path.startsWith(listing.directory + PathPart.Separator)),
  ),
);
export type NativeFileListing = z.infer<typeof NativeFileListingSchema>;
export const NativeReadObservationSchema = z.union([
  NativeFileObservationSchema,
  NativeFileListingSchema,
]);
export type NativeReadObservation = z.infer<typeof NativeReadObservationSchema>;
export const NativeFileObservationsSchema = z
  .array(NativeReadObservationSchema)
  .max(ConfigDefault.MaxWorkspaceEntriesLimit);
export const NativeFileResultSchema = z
  .strictObject({
    observation: NativeFileObservationSchema,
    content: z
      .string()
      .max(Math.ceil(NativeFileLimit.Bytes / 3) * 4)
      .nullable(),
  })
  .refine((result) => (result.content === null) === (result.observation.version === null));
export type NativeFileResult = z.infer<typeof NativeFileResultSchema>;
export const NativeFileListResultSchema = z.strictObject({ observation: NativeFileListingSchema });
export type NativeFileListResult = z.infer<typeof NativeFileListResultSchema>;
