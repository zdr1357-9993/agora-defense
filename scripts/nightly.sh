#!/usr/bin/env bash
# 밤 정기 실행 (CI 기준 v0 의 "느리지만 깊은 문").
#  - 최신 origin/develop 을 전용 작업 폴더(nightly worktree)로 받아서
#  - 빠른 검사(데이터·확률·빌드·번들) → E2E 5회 반복(flaky 확인) → 쿠버 A7/A8 전부(A8-3 DB 파드 장애 포함)
#  - 결과를 reports/nightly/<날짜>.md 에 Passed / Failed / Blocked / flaky 로 남긴다.
# 운영 Supabase 는 건드리지 않는다. push 하지 않는다. 고치지 않는다(판정만).
# 사용: bash scripts/nightly.sh            (cron: 매일 03:17)
set -uo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
REPO="$HOME/ai-deck/projects/random-defense/agora-defense"
WT="$HOME/ai-deck/projects/random-defense/agora-defense-envs/nightly"
DAY=$(date +%Y%m%d-%H%M)
OUT="/tmp/agora-nightly/$DAY"; mkdir -p "$OUT"
REPORT_DIR="$REPO/reports/nightly"; mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/$DAY.md"
LOG="$OUT/nightly.log"
exec > >(tee -a "$LOG") 2>&1

declare -a ROWS
row() { ROWS+=("| $1 | $2 | $3 |"); echo "[$2] $1 — $3"; }

echo "== 밤 정기 실행 $DAY"
cd "$REPO" || exit 2
git fetch -q origin || { row "git fetch" BLOCKED "GitHub 에 닿지 않음 (네트워크·DNS)"; }
if [ -d "$WT/.git" ] || [ -f "$WT/.git" ]; then
  git -C "$WT" checkout -q --detach origin/develop && git -C "$WT" clean -fdq -e node_modules
else
  git worktree add -q --detach "$WT" origin/develop
fi
SHA=$(git -C "$WT" rev-parse --short HEAD)
cd "$WT"

# 1) 빠른 검사
if npm ci --silent >"$OUT/npm-ci.log" 2>&1; then
  if npm run -s data >"$OUT/data.log" 2>&1 && npm test >"$OUT/test.log" 2>&1; then row "데이터·확률·메커닉 (npm test)" Passed "로그 test.log"
  elif grep -qE "AssertionError|FAIL" "$OUT/test.log" "$OUT/data.log" 2>/dev/null; then row "데이터·확률·메커닉 (npm test)" Failed "$(grep -m1 -E 'AssertionError|FAIL' "$OUT/test.log" "$OUT/data.log" | cut -c1-160)"
  else row "데이터·확률·메커닉 (npm test)" BLOCKED "판정 전 중단: $(tail -1 "$OUT/test.log" | cut -c1-160)"; fi
  if npm run -s build >"$OUT/build.log" 2>&1; then
    if node scripts/check-prod-bundle.mjs dist >"$OUT/bundle.log" 2>&1; then row "운영 번들 점검" Passed "QA 경로·비밀값 0건"
    else row "운영 번들 점검" Failed "$(grep -m1 -v '^$' "$OUT/bundle.log" | cut -c1-160)"; fi
  else row "빌드" Failed "$(tail -3 "$OUT/build.log" | tr '\n' ' ' | cut -c1-160)"; fi
else
  row "npm ci" BLOCKED "설치 실패 (네트워크·DNS·Node 버전) — npm-ci.log"
fi

# 2) E2E 5회 반복 → flaky 확인
export PW_OUT="$OUT/e2e"
npx playwright test --repeat-each=5 --reporter=json >"$OUT/e2e.json" 2>"$OUT/e2e.err"
node - "$OUT/e2e.json" >"$OUT/e2e-summary.txt" <<'EOF'
const fs = require('fs');
let j; try { j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); } catch { console.log('BLOCKED|결과 JSON 없음 (브라우저·dev 서버 문제)'); process.exit(0); }
const by = new Map();
const walk = (s) => { for (const sp of s.specs || []) for (const t of sp.tests || []) for (const r of t.results || []) {
  const k = `${t.projectName} › ${sp.title}`; const e = by.get(k) || { p: 0, f: 0, b: 0 };
  const env = /browserType\.launch|Executable doesn't exist|ECONNREFUSED|webServer/.test(JSON.stringify(r.errors || []));
  if (r.status === 'passed') e.p++; else if (env) e.b++; else e.f++; by.set(k, e); }
  for (const c of s.suites || []) walk(c); };
(j.suites || []).forEach(walk);
let pass = 0, fail = [], flaky = [], blocked = [];
for (const [k, e] of by) { if (e.b) blocked.push(k); else if (e.f && e.p) flaky.push(`${k} (${e.p}/${e.p + e.f})`); else if (e.f) fail.push(k); else pass++; }
console.log(`SUMMARY|${pass}|${fail.length}|${flaky.length}|${blocked.length}`);
fail.forEach((k) => console.log('FAIL|' + k)); flaky.forEach((k) => console.log('FLAKY|' + k)); blocked.forEach((k) => console.log('BLOCKED|' + k));
EOF
if grep -q '^SUMMARY' "$OUT/e2e-summary.txt"; then
  IFS='|' read -r _ P F FL B < <(grep '^SUMMARY' "$OUT/e2e-summary.txt")
  st=Passed; [ "$FL" != 0 ] && st=flaky; [ "$F" != 0 ] && st=Failed; [ "$B" != 0 ] && [ "$F" = 0 ] && st=BLOCKED
  row "E2E ×5 (데스크톱·모바일)" "$st" "안정 $P · 실패 $F · 흔들림 $FL · 막힘 $B"
else
  row "E2E ×5" BLOCKED "$(cut -d'|' -f2 "$OUT/e2e-summary.txt")"
fi

# 3) 쿠버: A7 + A8 전부 (A8-3 DB 파드 장애 포함)
if kubectl get nodes >/dev/null 2>&1; then
  bash k8s/agora-test/up.sh >"$OUT/k8s-up.log" 2>&1 || true
  PW_OUT="$OUT" bash k8s/agora-test/run.sh >"$OUT/k8s-run-console.log" 2>&1
  if [ -s "$OUT/k8s-results.json" ]; then
    S=$(node -e 'const r=require(process.argv[1]);const c={passed:0,failed:0,blocked:0};r.forEach(x=>c[x.status]++);const f=r.filter(x=>x.status!=="passed").map(x=>x.id+" "+x.detail).join(" / ");console.log(`${c.passed}|${c.failed}|${c.blocked}|${f}`)' "$OUT/k8s-results.json")
    IFS='|' read -r KP KF KB KD <<<"$S"
    st=Passed; [ "$KB" != 0 ] && st=BLOCKED; [ "$KF" != 0 ] && st=Failed
    A83=$(node -e 'const r=require(process.argv[1]).find(x=>x.id==="A8-3");console.log(r?r.detail:"없음")' "$OUT/k8s-results.json")
    row "쿠버 A7·A8 (권한·응답·동시·DB 파드 장애)" "$st" "통과 $KP · 실패 $KF · 막힘 $KB. A8-3: $A83 ${KD:+· $KD}"
  else
    row "쿠버 A7·A8" BLOCKED "결과 없음 — k8s-up.log / k8s-run-console.log (이미지·DNS·파드)"
  fi
else
  row "쿠버 A7·A8" BLOCKED "클러스터에 닿지 않음 (kind ai-lab 꺼짐 또는 docker 중지)"
fi

# 4) 보고서
{
  echo "# 밤 정기 실행 $DAY"
  echo
  echo "- 대상: origin/develop \`$SHA\`"
  echo "- 기준: docs/CI_CRITERIA.md (v0). 이 보고서는 판정만 한다. 고치지 않는다."
  echo "- 로그: \`$OUT\`"
  echo
  echo "| 단계 | 결과 | 근거 |"
  echo "|---|---|---|"
  printf '%s\n' "${ROWS[@]}"
  if grep -qE '^(FAIL|FLAKY|BLOCKED)\|' "$OUT/e2e-summary.txt" 2>/dev/null; then
    echo; echo "## E2E 상세"; grep -E '^(FAIL|FLAKY|BLOCKED)\|' "$OUT/e2e-summary.txt" | sed 's/^\([A-Z]*\)|/- **\1** /'
  fi
} >"$REPORT"
echo "보고서: $REPORT"
