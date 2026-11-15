#!/usr/bin/env bash
# Run each SMT-LIB claim through the z3 program in a container with no network.
# Prints the answer word, the exit code and the time for each file.
here=$(cd "$(dirname "$0")" && pwd)
docker run --rm --network none -v "$here:/w:ro" titan-probe/z3:1 z3 --version
for f in claim-true claim-false claim-hard; do
  start=$(date +%s%N)
  out=$(docker run --rm --network none -v "$here:/w:ro" titan-probe/z3:1 z3 -T:5 "/w/$f.smt2")
  code=$?
  ms=$(( ($(date +%s%N) - start) / 1000000 ))
  echo "== $f.smt2: exit $code, $ms ms (includes container start)"
  echo "$out"
done
