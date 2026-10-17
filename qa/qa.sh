#!/usr/bin/env bash
# npm run qa: serve in background, wait for ready, run scenarios, stop, propagate exit code.
set -uo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3100}"
mkdir -p qa/.out
if curl -s -o /dev/null "http://127.0.0.1:$PORT/login"; then
  echo "Port $PORT already in use; refusing to run against an unknown server." >&2
  exit 2
fi
bash qa/serve.sh > qa/.out/server.log 2>&1 &
SERVER=$!
cleanup() { pkill -P "$SERVER" 2>/dev/null; kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null; }
trap cleanup EXIT
echo "Building + starting QA server (log: qa/.out/server.log) ..."
for _ in $(seq 1 600); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/login"; then READY=1; break; fi
  kill -0 "$SERVER" 2>/dev/null || { echo "QA server died:" >&2; tail -30 qa/.out/server.log >&2; exit 1; }
  sleep 1
done
[ "${READY:-}" = 1 ] || { echo "QA server did not become ready" >&2; exit 1; }
QA_BASE="http://127.0.0.1:$PORT" node qa/run.mjs
