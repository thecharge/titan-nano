#!/usr/bin/env python3
"""Plain-language checker for Markdown documents.

Usage: python3 -I check-plain.py <file-or-folder> [...]

Reports, with file and line:
  LONG   a sentence with more than 30 words (aim for 20 or fewer)
  VAGUE  a vague word from the skill's list
  CODE   a sentence that starts with an internal code (Lnn, F-nn, G-nn, A-nn, Dnn)
  NUM    a task number referenced in a spec, design or proposal that is missing from tasks.md
Exit code 0 when nothing is found, 1 otherwise.

Text inside code blocks, inline code, quoted lines (starting with ">") and text
in double quotes is skipped, because quotes from sources must not be changed.
The limits are this project's own choice, not numbers from ISO 24495-1.
"""
import os
import re
import sys

MAX_WORDS = 30
VAGUE = [
    "robust", "seamless", "seamlessly", "leverage", "leverages", "appropriate",
    "appropriately", "as needed", "various", "etc.", "and so on", "efficient",
    "efficiently", "properly", "optimal", "best-in-class", "state-of-the-art",
    "simply", "obviously", "clearly", "basically", "handled",
]
VAGUE_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(w) for w in VAGUE) + r")(?![\w-])", re.I)
# A code used as the subject of a sentence, for example "G-01 asked for ...".
# A code as a reference ("(L25)", "Ledger: L07, L34", "F-01 to F-25") is allowed.
CODE_START = re.compile(r"^(L\d{2}|[FGA]-\d{2}|D\d{1,2}) (?!to\b|and\b)[a-z]")
TASK_REF = re.compile(r"\b[Tt]asks? (\d+\.\d+)")


def files(args: list[str]):
    for a in args:
        if os.path.isdir(a):
            for root, _, names in os.walk(a):
                if "/research" in root.replace(os.sep, "/"):
                    continue
                for n in sorted(names):
                    if n.endswith(".md"):
                        yield os.path.join(root, n)
        else:
            yield a


def clean(line: str) -> str:
    line = re.sub(r"`[^`]*`", "X", line)
    line = re.sub(r"\"[^\"]*\"|“[^”]*”", "X", line)
    line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)
    line = re.sub(r"https?://\S+", "X", line)
    return line


def task_ids(path: str) -> "set[str] | None":
    d = os.path.dirname(os.path.abspath(path))
    for _ in range(4):
        t = os.path.join(d, "tasks.md")
        if os.path.exists(t):
            return set(re.findall(r"^- \[[ x]\] (\d+\.\d+)", open(t, encoding="utf-8").read(), re.M))
        d = os.path.dirname(d)
    return None


def check(path: str) -> list[str]:
    out: list[str] = []
    in_code = False
    tasks = task_ids(path) if os.path.basename(path) != "tasks.md" else None
    for n, raw in enumerate(open(path, encoding="utf-8"), 1):
        s = raw.rstrip("\n")
        if s.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or s.lstrip().startswith(">") or s.lstrip().startswith("|---"):
            continue
        text = clean(s)
        body = re.sub(r"^\s*([-*]|\d+\.|#+|- \[[ x]\] \d+\.\d+)\s*", "", text)
        parts = body.split("|") if body.lstrip().startswith("|") or "|" in body[:2] else [body]
        sents = [x for part in parts for x in re.split(r"(?<=[.!?;])\s+", part)]
        for sent in sents:
            words = re.findall(r"[\w’'-]+", sent)
            if len(words) > MAX_WORDS:
                out.append(f"LONG  {path}:{n} {len(words)} words: {sent[:90]}...")
            if CODE_START.match(sent.strip("* ")):
                out.append(f"CODE  {path}:{n} sentence starts with a code: {sent[:60]}")
        for m in VAGUE_RE.finditer(text):
            out.append(f"VAGUE {path}:{n} '{m.group(1)}': {s.strip()[:90]}")
        if tasks is not None:
            for m in TASK_REF.finditer(s):
                if m.group(1) not in tasks:
                    out.append(f"NUM   {path}:{n} task {m.group(1)} is not in tasks.md")
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    found: list[str] = []
    count = 0
    for p in files(sys.argv[1:]):
        count += 1
        found += check(p)
    for f in found:
        print(f)
    kinds: dict[str, int] = {}
    for f in found:
        kinds[f.split()[0]] = kinds.get(f.split()[0], 0) + 1
    print(f"\n{count} file(s) checked, {len(found)} finding(s) {kinds}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
