import { AgentTool, backendIds } from "@titan/constants";
import { z } from "zod";

const schema = z.record(z.string(), z.unknown());
export const PersonaSchema = z.strictObject({
  request_turns: z.boolean().optional(),
  description: z.string().min(1),
  role: z.string().min(1),
  tags: z.array(z.string()).default([]),
  backend: z.enum(backendIds).optional(),
  model: z.string().optional(),
  tools: z.array(z.enum(AgentTool)).default([]),
  skills: z.array(z.string().min(1)).optional(),
  tool_servers: z.array(z.string().min(1)).optional(),
  inputs: z.record(z.string(), schema).optional(),
  outputs: z.record(z.string(), schema).optional(),
});
export type Persona = z.infer<typeof PersonaSchema>;
