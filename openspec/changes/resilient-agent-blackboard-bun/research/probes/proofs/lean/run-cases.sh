#!/bin/bash
# Runs inside the container. /lean is the toolchain, /work is a copy of the probe.
export PATH=/lean/bin:$PATH
cd /work/proj
# Trusted set-up: write the manifest before any agent file is built.
lake update 2>&1 | sed 's/^/setup | /'
ls lake-manifest.json
for c in good sorry weakened redefined axiom native; do
  echo "=== case $c"
  cp /work/cases/$c.lean Solution.lean
  rm -rf .lake build
  { cat Solution.lean; echo; echo "#print axioms sumTo_formula"; echo "#print axioms sumTo_100"; } > /tmp/plain.lean
  s=$(date +%s%N); out=$(lean /tmp/plain.lean 2>&1); code=$?; e=$(date +%s%N)
  echo "plain lean exit=$code ms=$(( (e-s)/1000000 ))"; echo "$out" | sed 's/^/  | /'
  s=$(date +%s%N); out=$(lake check 2>&1); code=$?; e=$(date +%s%N)
  echo "lake check, no default target, exit=$code ms=$(( (e-s)/1000000 ))"; echo "$out" | tail -6 | sed 's/^/  | /'
  rm -rf .lake; cp lakefile.toml /tmp/lakefile.orig
  { echo 'defaultTargets = ["Solution"]'; cat /tmp/lakefile.orig; } > lakefile.toml
  s=$(date +%s%N); out=$(lake check 2>&1); code=$?; e=$(date +%s%N)
  echo "lake check, default target Solution, exit=$code ms=$(( (e-s)/1000000 ))"; echo "$out" | tail -6 | sed 's/^/  | /'
  cp /tmp/lakefile.orig lakefile.toml
  rm -rf .lake
  s=$(date +%s%N); out=$(lake comparator 2>&1); code=$?; e=$(date +%s%N)
  echo "lake comparator exit=$code ms=$(( (e-s)/1000000 ))"; echo "$out" | grep -v '^Exporting' | tail -6 | sed 's/^/  | /'
done
