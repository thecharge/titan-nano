#!/usr/bin/env bash
# Start the dashboard on a fake run folder, log in with the one-time code in
# headless Chrome, append one event while the page is open, and take a screenshot.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
mkdir -p "$work/runs/run-past" "$work/runs/run-live" "$here/out/shots"
bun -e 'import { events } from "'"$here"'/test/fake-run.ts"; const l = (e) => JSON.stringify(e) + "\n";
await Bun.write(process.argv[1] + "/runs/run-past/events.jsonl", events.map(l).join(""));
await Bun.write(process.argv[1] + "/runs/run-live/events.jsonl", events.slice(0, 3).map(l).join(""));' "$work"
bun "$here/dashboard/server.ts" "$work" 47123 > "$work/server.log" &
pid=$!
trap 'kill $pid' EXIT
sleep 1
login=$(sed -n 's/^open //p' "$work/server.log")
echo "login URL shape: ${login%%code=*}code=<one-time>"
# Append event 4 three seconds after Chrome opens the page; the page must show it without a reload.
( sleep 3; bun -e 'import { events } from "'"$here"'/test/fake-run.ts"; const fs = require("node:fs");
fs.appendFileSync(process.argv[1] + "/runs/run-live/events.jsonl", JSON.stringify(events[3]) + "\n");' "$work" ) &
timeout 60 google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$work/chrome" \
  --window-size=1400,500 --timeout=6000 --screenshot="$here/out/shots/titan-dashboard.png" "$login" 2>/dev/null
# Live update: keep one tab open, add event 4 and event 5, then capture the same tab without a reload.
code2=$(curl -s "http://127.0.0.1:47123/login?code=x" -o /dev/null -w '%{http_code}')
echo "reusing or guessing a code: $code2"
kill $pid; wait $pid 2>/dev/null || true
bun "$here/dashboard/server.ts" "$work" 47123 > "$work/server2.log" &
pid=$!
sleep 1
login=$(sed -n 's/^open //p' "$work/server2.log")
google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$work/chrome3" --window-size=1400,500 \
  --remote-debugging-port=9333 "$login" 2>/dev/null &
cpid=$!
sleep 3
bun -e 'import { events } from "'"$here"'/test/fake-run.ts"; const fs = require("node:fs");
for (const e of events.slice(4, 6)) fs.appendFileSync(process.argv[1] + "/runs/run-live/events.jsonl", JSON.stringify(e) + "\n");' "$work"
sleep 2
bun "$here/test/cdp-shot.ts" 9333 "$here/out/shots/titan-dashboard-live.png" '"id":6' || echo "live screenshot check FAILED"
kill $cpid
echo "second browser without the cookie: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:47123/api/runs) on /api/runs"
