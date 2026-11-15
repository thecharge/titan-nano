export function finalAttempt(task, cwd, checker, prompt) {
  if (
    ![
      "final_worker_retry",
      "final_checker_retry",
      "final_worker_blocked",
      "final_checker_blocked",
    ].includes(task)
  )
    return null;
  const match = /\/steps\/deliver\/attempt-([123])\/(work|review-0)$/.exec(cwd);
  if (!match || checker !== (match[2] === "review-0"))
    throw new Error("Invalid final-attempt workspace");
  const attempt = Number(match[1]);
  if (!checker) {
    const expected = Array.from(
      { length: attempt - 1 },
      (_, index) => `Rejected candidate on attempt ${index + 1}`,
    );
    if (JSON.stringify(JSON.parse(prompt).prior_refutations) !== JSON.stringify(expected))
      throw new Error("Final-attempt refutation history changed");
  }
  return {
    mode:
      attempt === 3 && checker === task.startsWith("final_checker")
        ? task.endsWith("blocked")
          ? "rate_wait_once"
          : "rate_limit_once"
        : "complete",
    verdict:
      checker && attempt < 3
        ? { verdict: "refuted", evidence: `Rejected candidate on attempt ${attempt}` }
        : null,
  };
}
