import { DocumentationFormat } from "@titan/constants";
import { z } from "zod";

import { exactStringList } from "./validation.ts";

export const DocumentationFormatSchema = z.strictObject({
  lineWidth: z.literal(DocumentationFormat.LineWidth),
  newLineKind: z.literal(DocumentationFormat.Newline),
  markdown: z.strictObject({
    textWrap: z.literal(DocumentationFormat.TextWrap),
    "codeBlock.skipFormat": z.literal(true),
  }),
  dockerfile: z.strictObject({
    associations: exactStringList(DocumentationFormat.ContainerAssociations),
  }),
  includes: exactStringList(DocumentationFormat.Includes),
  excludes: exactStringList(DocumentationFormat.Excludes),
  plugins: exactStringList(DocumentationFormat.Plugins),
});
