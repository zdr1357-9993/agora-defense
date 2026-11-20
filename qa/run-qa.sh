#!/usr/bin/env bash
# 서버에서 데이터 검사 + Playwright E2E 를 돌리고 TestRail 에 기록한다.
# 키는 qa/.env.testrail 에 둔다 (git 에 올라가지 않음). 예시는 qa/.env.testrail.example
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f qa/.env.testrail ]; then set -a; . qa/.env.testrail; set +a; else echo "qa/.env.testrail 이 없습니다. qa/.env.testrail.example 을 복사해 채워 주세요."; exit 2; fi
export PW_OUT="${PW_OUT:-/tmp/agora-e2e}"
node qa/testrail-push.mjs
