import { Development, ProcessIo } from "@titan/constants";

const child = Bun.spawn(
  [
    Development.Python,
    Development.IsolatedPython,
    Development.PlainCheck,
    Development.Specs,
    Development.Docs,
    Development.CodexSkills,
    Development.ClaudeSkills,
  ],
  {
    stdout: ProcessIo.Inherit,
    stderr: ProcessIo.Inherit,
  },
);
process.exit(await child.exited);
