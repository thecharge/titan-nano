import { positive, rejected } from "@titan/test-factories";

export const commitSubjectCases = {
  positive: [
    positive("dev-standards > Subject in the new form", ["docs(openspec): add test strategy"], {
      code: 0,
      failed: false,
    }),
    positive("scope is optional", ["fix: repair the lease"], { code: 0, failed: false }),
    positive("breaking change marker is accepted", ["feat(core)!: change the port"], {
      code: 0,
      failed: false,
    }),
  ],
  negative: [
    rejected("dev-standards > Subject in the old form", ["Add hive and approvals"], {
      code: 1,
      failed: true,
    }),
    rejected("unknown type is refused", ["wip(core): half done"], { code: 1, failed: true }),
    rejected("empty description is refused", ["feat(core):"], { code: 1, failed: true }),
  ],
};

export const commitSubjectMessageCases = {
  positive: [
    positive(
      "the failure line names the subject",
      ["Add hive and approvals"],
      "FAIL Add hive and approvals",
    ),
    positive("the failure line keeps the scope text", ["feat(core):"], "FAIL feat(core):"),
  ],
  negative: [
    rejected("an empty subject still gets a failure line", [""], "FAIL "),
    rejected("a long subject is reported whole", ["x".repeat(200)], `FAIL ${"x".repeat(200)}`),
  ],
};
