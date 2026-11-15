import { LintPolicy } from "@titan/constants";
import { z } from "zod";
import { exactStringList } from "./validation.ts";

function plugin(path: string, includes: readonly string[]) {
  return z.strictObject({ path: z.literal(path), includes: exactStringList(includes) });
}

const formatting = z.strictObject({
  indentStyle: z.literal(LintPolicy.IndentStyle),
  indentWidth: z.literal(LintPolicy.IndentWidth),
  lineWidth: z.literal(LintPolicy.LineWidth),
});
const javascript = z.strictObject({
  formatter: z.strictObject({
    quoteStyle: z.literal(LintPolicy.QuoteStyle),
    semicolons: z.literal(LintPolicy.Semicolons),
  }),
});
const rules = z.strictObject({
  preset: z.literal(LintPolicy.Recommended),
  nursery: z.strictObject({ noFloatingPromises: z.literal(LintPolicy.Error) }),
  suspicious: z.strictObject({ noImportCycles: z.literal(LintPolicy.Error) }),
});
const linter = z.strictObject({
  enabled: z.literal(true),
  rules,
  domains: z.strictObject({ project: z.literal(LintPolicy.Project) }),
});
export const LintPolicySchema = z.strictObject({
  $schema: z.literal(LintPolicy.Schema),
  files: z.strictObject({ includes: exactStringList(LintPolicy.Includes) }),
  formatter: formatting,
  javascript,
  markdown: z.strictObject({
    formatter: z.strictObject({ enabled: z.literal(false) }),
  }),
  linter,
  plugins: z.tuple([
    plugin(LintPolicy.ValuePlugin, LintPolicy.ValueIncludes),
    plugin(LintPolicy.ShapePlugin, LintPolicy.ShapeIncludes),
    plugin(LintPolicy.LiteralPlugin, LintPolicy.LiteralIncludes),
  ]),
});
