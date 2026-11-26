#!/usr/bin/env bash
# 뽑기·카드 무결성 구멍 재현 시험(tests-proposed/gacha-hole).
# scripts/ci-db-security.sh 와 동일한 방식(빈 Postgres + 운영 마이그레이션 + PostgREST)을 사용한다.
# 필요: psql, 비어 있는 Postgres (PGHOST/PGPORT/PGUSER/PGPASSWORD), node 22, curl
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGHOST:=127.0.0.1}" "${PGPORT:=5432}" "${PGUSER:=postgres}"
export PGHOST PGPORT PGUSER
API_PORT=${API_PORT:-3300}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
PGRST=${PGRST_BIN:-/tmp/postgrest}
OUT=${PW_OUT:-/tmp/agora-gacha-hole}; mkdir -p "$OUT"

echo "== DB 초기화: Supabase 흉내 → 스키마 → 마이그레이션 전부(이름순) → 시험 계정"
files=(k8s/agora-test/sql/00-supabase-shim.sql supabase/schema.sql)
while IFS= read -r f; do files+=("$f"); done < <(ls supabase/migrations/*.sql | sort)
files+=(k8s/agora-test/sql/99-seed.sql)
for f in "${files[@]}"; do
  echo "  $f"
  psql -v ON_ERROR_STOP=1 -q -f "$f" postgres >/dev/null || { echo "FAIL: $f 적용 실패"; exit 1; }
done

if [ ! -x "$PGRST" ]; then
  echo "== PostgREST 내려받기"
  curl -fsSL -o /tmp/pgrst.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz \
    || { echo "BLOCKED: PostgREST 를 내려받지 못함"; exit 2; }
  tar -xJf /tmp/pgrst.tar.xz -C /tmp && PGRST=/tmp/postgrest
fi

echo "== PostgREST 시작 (:$API_PORT)"
PGRST_DB_URI="postgres://authenticator:authenticator@$PGHOST:$PGPORT/postgres" PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=$API_PORT \
  "$PGRST" > "$OUT/postgrest.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

echo "== 구멍 재현 시험 실행"
API_URL="http://127.0.0.1:$API_PORT" JWT_SECRET="$JWT_SECRET" \
  node tests-proposed/gacha-hole/test-gacha-hole.mjs
