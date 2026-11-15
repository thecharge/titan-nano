import { negative, positive } from "@titan/test-factories";

export const programFileCases = {
  positive: [
    positive("native executable is readable and executable", ["regular", true], true),
    positive("interpreter script only needs read access", ["nonexec", false], true),
  ],
  negative: [
    negative("missing executable cannot enter SDK spawn", ["missing", true], {
      code: "backend_executable",
    }),
    negative("directory is not an executable", ["directory", true], { code: "backend_executable" }),
    negative("native executable requires execute permission", ["nonexec", true], {
      code: "backend_executable",
    }),
  ],
};
