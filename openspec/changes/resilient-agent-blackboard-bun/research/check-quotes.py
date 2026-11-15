#!/usr/bin/env python3
"""Check that every quoted passage in research.md appears verbatim in its source text.

Usage: python3 -I check-quotes.py <research.md> <text-dir> <probes-dir>

Quote lines in research.md have the form
    > [<id>] "<passage>"
where <id> is a source id from sources.tsv (1..70, R1..R4) or probe:<file>.
<text-dir>/<id>.txt holds the plain text extracted from the fetched source
(33plain.txt is used for source 33). Whitespace is collapsed before matching.
Exit code is 1 if any quote is not found.
"""
import os, re, sys

md, text_dir, probe_dir = sys.argv[1:4]
norm = lambda s: re.sub(r"\s+", " ", s).strip()
cache = {}

def load(sid):
    if sid not in cache:
        if sid.startswith("probe:"):
            p = os.path.join(probe_dir, sid[6:])
        else:
            p = os.path.join(text_dir, ("33plain" if sid == "33" else sid) + ".txt")
        cache[sid] = norm(open(p, errors="replace").read()) if os.path.exists(p) else None
    return cache[sid]

ok = bad = 0
for n, line in enumerate(open(md), 1):
    m = re.match(r'^> \[([^\]]+)\] "(.*)"\s*$', line)
    if not m:
        continue
    sid, q = m.group(1), norm(m.group(2))
    t = load(sid)
    if t is not None and q in t:
        ok += 1
        print(f"FOUND   line {n:4d} [{sid}] {q[:90]}")
    else:
        bad += 1
        print(f"MISSING line {n:4d} [{sid}] {q[:90]}" + ("" if t is not None else "  (no text file)"))
print(f"\n{ok} quotes found verbatim, {bad} missing")
sys.exit(1 if bad else 0)
