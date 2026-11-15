#!/bin/sh
if [ "$1" = install ]; then
  printf '%s\n' "$PWD" "$@" >> "$TITAN_TEST_INSTALL_RECORD.setup"
  [ "$TITAN_TEST_INSTALL_CASE" != setup-failure ] || exit 1
else
  printf '%s\n' "$PWD" "$@" > "$TITAN_TEST_INSTALL_RECORD"
fi
if [ "$TITAN_TEST_INSTALL_CASE" = doctor-failure ]; then exit 1; fi
