import { ApprovalLevel, LocalServer, ServerCredential } from "@titan/constants";
import { z } from "zod";

export const PersonTokenSchema = z
  .string()
  .length(ServerCredential.TokenCharacters)
  .regex(ServerCredential.Pattern);
export const ServerCredentialsSchema = z.strictObject({
  agent: z.string().min(LocalServer.TokenMinimumLength),
  person: PersonTokenSchema,
});
export type ServerCredentials = z.infer<typeof ServerCredentialsSchema>;
export const ClientAuthoritySchema = z.enum([ApprovalLevel.Main, ApprovalLevel.Human]);
export type ClientAuthority = z.infer<typeof ClientAuthoritySchema>;
