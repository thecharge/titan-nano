#!/bin/sh
printf '%s\n' "$$" > "$TITAN_TEST_GIT_RECORD"
sleep 60 &
printf '%s\n' "$!" >> "$TITAN_TEST_GIT_RECORD"
wait
