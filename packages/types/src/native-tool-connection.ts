import { isAbsolute, resolve } from "node:path";
import {
  ConfigDefault,
  EventCursor,
  LocalServer,
  NativeTool,
  NativeToolPolicy,
  ServerLimit,
  TextSymbol,
} from "@titan/constants";
import { z } from "zod";
import { PersonTokenSchema } from "./credentials.ts";
import { NativeToolScopeSchema } from "./native-tools.ts";
import { WorkspacePathSchema } from "./workspace-path.ts";

const url = z
  .url()
  .max(ServerLimit.SummaryCharacters)
  .pipe(
    z.string().refine((value) => {
      const address = new URL(value);
      return (
        address.protocol === LocalServer.Protocol &&
        address.hostname === LocalServer.Host &&
        address.pathname === NativeTool.Route &&
        address.username === TextSymbol.Empty &&
        address.password === TextSymbol.Empty &&
        address.search === TextSymbol.Empty &&
        address.hash === TextSymbol.Empty
      );
    }),
  );
export const NativeToolConnectionSchema = z.strictObject({
  url,
  token: PersonTokenSchema,
  scope: NativeToolScopeSchema,
  run_directory: WorkspacePathSchema.max(ServerLimit.SummaryCharacters).refine(
    (path) => isAbsolute(path) && resolve(path) === path,
  ),
  timeout_ms: z.number().int().positive().max(ConfigDefault.HostStartupLimit),
});
export type NativeToolConnection = z.infer<typeof NativeToolConnectionSchema>;
export const NativeToolReadySchema = NativeToolScopeSchema.extend({
  schema_version: z.literal(NativeTool.Version),
  tools: z
    .array(z.string().min(1).max(ServerLimit.IdentityCharacters))
    .max(Math.max(...Object.values(NativeToolPolicy).map((tools) => tools.length))),
});
export const NativeToolEnvironmentNumberSchema = z
  .string()
  .max(String(Number.MAX_SAFE_INTEGER).length)
  .regex(EventCursor.IntegerPattern)
  .transform(Number);
