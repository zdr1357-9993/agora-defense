#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID="${TMPDIR:-/tmp}/agora-defense-stage.pid"
LOG="${TMPDIR:-/tmp}/agora-defense-stage.log"
action="${1:-status}"

case "$action" in
  start)
    [[ -f "$ROOT/dist-stage/index.html" ]] || { echo "missing dist-stage; run npm run build:stage first" >&2; exit 1; }
    if [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "stage already running (pid $(cat "$PID"))"; exit 0; fi
    cd "$ROOT"
    nohup "$ROOT/node_modules/.bin/vite" preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist-stage >>"$LOG" 2>&1 </dev/null &
    echo "$!" > "$PID"
    sleep 1
    if ! kill -0 "$(cat "$PID")" 2>/dev/null; then cat "$LOG"; exit 1; fi
    echo "stage started: http://127.0.0.1:4173 (pid $(cat "$PID"), log $LOG)" ;;
  stop)
    if [[ -f "$PID" ]]; then kill "$(cat "$PID")" 2>/dev/null || true; rm -f "$PID"; echo "stage stopped"; else echo "stage is not running"; fi ;;
  session) "$0" start; exec sleep infinity ;;
  restart) "$0" stop; exec "$0" start ;;
  status)
    if [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "stage running: http://127.0.0.1:4173 (pid $(cat "$PID"))"; else echo "stage is not running"; exit 1; fi ;;
  *) echo "usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
