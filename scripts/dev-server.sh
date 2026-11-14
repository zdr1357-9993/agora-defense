#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID="${TMPDIR:-/tmp}/agora-defense-dev.pid"
LOG="${TMPDIR:-/tmp}/agora-defense-dev.log"
action="${1:-status}"

case "$action" in
  start)
    if [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "dev already running (pid $(cat "$PID"))"; exit 0; fi
    cd "$ROOT"
    nohup "$ROOT/node_modules/.bin/vite" --host 127.0.0.1 --port 5173 --strictPort >>"$LOG" 2>&1 </dev/null &
    echo "$!" > "$PID"
    sleep 1
    if ! kill -0 "$(cat "$PID")" 2>/dev/null; then cat "$LOG"; exit 1; fi
    echo "dev started: http://127.0.0.1:5173 (pid $(cat "$PID"), log $LOG)" ;;
  stop)
    if [[ -f "$PID" ]]; then kill "$(cat "$PID")" 2>/dev/null || true; rm -f "$PID"; echo "dev stopped"; else echo "dev is not running"; fi ;;
  session) "$0" start; exec sleep infinity ;;
  restart) "$0" stop; exec "$0" start ;;
  status)
    if [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "dev running: http://127.0.0.1:5173 (pid $(cat "$PID"))"; else echo "dev is not running"; exit 1; fi ;;
  *) echo "usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
