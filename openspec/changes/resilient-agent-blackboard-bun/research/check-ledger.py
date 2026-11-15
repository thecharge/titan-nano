#!/usr/bin/env python3
"""Check ledger structure in research.md.

Usage: python3 -I check-ledger.py <research.md>

Every **Lnn. ... VERDICT** entry must have
  - a verdict keyword, and
  - at least one quote line (> [id] "...") of 40 or more characters, or
  - "(see Lnn[, Lmm])" naming entries that themselves have quotes, or
  - the verdict NOT FOUND, or
  - the verdict UNVERIFIABLE with a quote of the error page (any length).
Exit code 1 on any failure.
"""
import re, sys
VERDICTS = ["VERIFIED", "PARTIAL", "CONTRADICTED", "MISATTRIBUTED", "UNVERIFIABLE", "NOT FOUND"]
text = open(sys.argv[1]).read()
heads = list(re.finditer(r"^\*\*L(\d+)\. (.*)\*\*\s*$", text, re.M))
entries = {}
for i, h in enumerate(heads):
    end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
    body = text[h.end():end].split("\n## ")[0]
    quotes = re.findall(r'^> \[[^\]]+\] "(.*)"\s*$', body, re.M)
    entries[int(h.group(1))] = (h.group(2), quotes)
def primary_verdict(head):
    """The verdict keyword that appears first in the heading, ignoring quoted
    blueprint text (e.g. L83 "... CONTRADICTED for a fresh boot; VERIFIED ...")."""
    unquoted = re.sub(r'"[^"]*"', "", head)
    found = sorted((unquoted.find(v), v) for v in VERDICTS if v in unquoted)
    return found[0][1] if found else None

bad = 0
counts = {v: 0 for v in VERDICTS}
for n, (head, quotes) in sorted(entries.items()):
    verdict = primary_verdict(head)
    if verdict:
        counts[verdict] += 1
    long_q = [q for q in quotes if len(q) >= 40]
    see = [int(x) for x in re.findall(r"L(\d+)", (re.search(r"\(see ([^)]*)\)", head) or [None, ""])[1])]
    inherited = [m for m in see if m in entries and any(len(q) >= 40 for q in entries[m][1])]
    if verdict is None:
        status = "FAIL no verdict"
    elif long_q:
        status = f"ok   {len(long_q)} quote(s) >= 40 chars"
    elif verdict == "UNVERIFIABLE" and quotes:
        status = "ok   UNVERIFIABLE, error page quoted"
    elif inherited:
        status = "ok   inherits " + ",".join(f"L{m:02d}" for m in inherited)
    elif verdict == "NOT FOUND":
        status = "ok   NOT FOUND (no source passage exists)"
    else:
        status = "FAIL no quote >= 40 chars and no quoted (see Lnn)"
    if status.startswith("FAIL"):
        bad += 1
    print(f"L{n:02d} {verdict or '-':13s} {status}")
print("\nprimary verdicts: " + ", ".join(f"{v} {counts[v]}" for v in VERDICTS))
print(f"{len(entries)} entries, {bad} failing")
sys.exit(1 if bad else 0)
