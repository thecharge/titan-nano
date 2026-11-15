import { z } from "zod";

export const McpTextContentSchema = z.array(z.object({ type: z.string(), text: z.string() }));
