#!/usr/bin/env bash
# Runs run-cases.sh in the lean-bwrap image with no network, as the non-root user prover.
# usage: run-in-container.sh <folder holding the unpacked lean-4.35.0-linux toolchain> > out/cases-v7.out
# --privileged is needed only because bwrap inside Docker could not mount /proc otherwise (see out/cases-v6.out).
set -u
lean=$1
here=$(cd "$(dirname "$0")" && pwd)
docker run --rm --network none --user prover --privileged \
  -v "$lean:/lean:ro" -v "$here:/src:ro" titan-probe/lean-bwrap:2 \
  bash -c 'export XDG_RUNTIME_DIR=/run/user/$(id -u); cp -r /src /tmp/w; sed -i "s#/work#/tmp/w#g" /tmp/w/run-cases.sh; /tmp/w/run-cases.sh' 2>&1
