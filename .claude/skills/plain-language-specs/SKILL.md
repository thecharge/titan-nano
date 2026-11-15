---
name: plain-language-specs
description: Write or rewrite OpenSpec artifacts (proposal, specs, design, tasks) and other project documents in plain language that follows ISO 24495-1, using the simplest words possible, with strict checks. Use every time you write or edit a spec, proposal, design, tasks list, README or report in this project, and before you commit one.
metadata:
  author: thecharge
  version: "1.0"
---

Write so that a person who did not take part in the work can read the document once and understand it. The user rejected an earlier version after 3 hours of reading, because it was full of hard words, codes and long sentences. Do not let that happen again.

**Source.** ISO 24495-1:2023, *Plain language — Part 1: Governing principles and guidelines*. A free sample is at https://cdn.standards.iteh.ai/samples/78907/d194fac21d6a45f38bfcfec9657f7498/ISO-24495-1-2023.pdf. Its four principles are:
1. Readers get what they need (relevant).
2. Readers can easily find what they need (findable).
3. Readers can easily understand what they find (understandable).
4. Readers can easily use the information (usable).

The rules below follow the guidelines under those principles (sections 5.1 to 5.4 of the standard). The number limits in the rules are this project's own choice. They are not from ISO.

---

## Steps

Do these steps in order. Do not skip one.

### 1. Use OpenSpec first
- For an OpenSpec artifact, run `openspec instructions <artifact> --change <name> --json`. Use its `template` exactly, with no extra sections. Follow its `instruction` and `rules`. Do not copy `context` or `rules` into the file.
- Read the artifacts that this one depends on.

### 2. Decide who reads it and why (ISO 5.1)
Before you write, write down for yourself, in one line each:
- **Reader:** who reads this? Default: a developer who is new to the project.
- **Purpose:** what must the reader be able to do after reading it?
- **Content:** what does the reader need for that? Leave out everything else. Put evidence and history in `research/`, not in the main text.

### 3. Structure it so things are easy to find (ISO 5.2)
- One idea per heading. A heading says what the section is about, in plain words: "How a run starts", not "Entrypoint semantics".
- Put the most important thing first in each section.
- Use a list when there are 3 or more parallel items. Use a numbered list when order matters. Use a table when you compare things on the same features.
- Keep extra detail (evidence, measurements, ledger ids) at the end of a section, after the main text.

### 4. Write so it is easy to understand (ISO 5.3)

**Words**
- Use the most common word that is correct: "use", not "utilise"; "start", not "instantiate"; "check", not "validate" (unless you mean zod validation); "about", not "approximately".
- Define every technical term the first time you use it, in the same sentence or the next one. Write: "A *lease* is a time limit on a claim." Keep a short word list in design.md's Context.
- Use one word for one thing in the whole change. Do not switch between "worker", "agent" and "knowledge source" for the same thing.
- Do not use internal codes as words. A ledger id (L25) or a review code (F-01) can be added at the end as a reference, but the sentence must make sense without it.
- Write the full name of a short form the first time, unless the short form is the known name and the full name helps no one (for example SQLite, JSON, URL). If you do not know the full name, do not guess. Write what the thing does and name the source.

**Sentences**
- Keep sentences short. Aim for 20 words or fewer. More than 30 words is an error that the checker reports.
- One idea per sentence.
- Use the active voice and say who does it: "The gateway asks each server for its tools", not "Tools are discovered".
- Put the main point before any condition only when the condition is short. Otherwise split it into two sentences.
- Do not stack nouns: "the time limit for each server call", not "per-server call timeout budget".
- Use "must"/"SHALL" only for requirements. In specs, the first paragraph of each requirement must contain SHALL or MUST, because `openspec validate` checks it.

**Vague words are not allowed**
Do not write vague words. Say the exact thing. The checker reports these words:
"robust", "seamless", "leverage", "appropriate", "as needed", "various", "etc.", "and so on", "efficient", "properly", "relevant" (as an empty adjective), "handle" (as in "handles errors": say what happens), "support" (say what it does), "optimal", "best-in-class", "state-of-the-art", "simply", "just", "obviously", "clearly", "basically".

**Numbers**
- Each number is either measured, with the file that holds the measurement, or labelled as a guess: "a guess that has not been measured".
- Give units: "15 s", "1024 MiB", "p95 300 ms". Explain p50/p95/p99 the first time.

**Tone and cohesion**
- Talk to the reader in a respectful, neutral way. No marketing words.
- Point to other documents by name, for example "spec safe-state-fallback". Do not point to a decision or task by number unless that number is fixed. If you do point to a task number, check that tasks.md has that task.

### 5. Check it (ISO 5.4)
Run all of these, and fix every finding before you call the work done:

```bash
python3 -I .claude/skills/plain-language-specs/check-plain.py <files or folder>
openspec validate <change> --strict
```

Then read the document once as the reader from step 2 would. Ask: can I do the purpose with only this text? If not, fix it.

When the change has a research ledger, also run the ledger and quote checks, and confirm that no requirement, scenario, ledger id or review id was lost compared with the last commit.

### 6. Report
- State the checker's output, with its numbers, before you claim the text is plain.
- State any finding you chose not to fix, and why. For example, a long sentence inside a quote from a source cannot be changed.

---

## Guardrails

- Never trade content for simplicity. Every requirement, scenario, number and source must stay. Make the words simpler, not the meaning thinner.
- Never change a verbatim quote from a source to make it simpler. Explain it in your own plain words next to it.
- Never invent a full name, a figure or a source to fill a gap. Say that it is unknown.
- Never say that the text "follows ISO 24495-1" unless the checker passed and you did the read-through in step 5.
- If a rule here conflicts with an OpenSpec template or with `openspec validate`, the OpenSpec rule wins. Say so in the report.
