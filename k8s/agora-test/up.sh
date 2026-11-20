#!/usr/bin/env bash
# A7/A8 시험 환경 띄우기 (kind 클러스터 필요). 비밀키는 매번 무작위, git 에 남지 않는다.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=../..
kubectl apply -f - <<<'{"apiVersion":"v1","kind":"Namespace","metadata":{"name":"agora-test"}}'
kubectl -n agora-test create secret generic agora-secrets \
  --from-literal=jwt_secret="$(openssl rand -hex 32)" \
  --from-literal=pg_password="$(openssl rand -hex 16)" \
  --dry-run=client -o yaml | kubectl apply -f -
# DB 초기화 SQL: 시험용 Supabase 흉내 → 운영과 같은 스키마·마이그레이션 → 시험 계정
kubectl -n agora-test create configmap agora-initsql \
  --from-file=00-shim.sql=sql/00-supabase-shim.sql \
  --from-file=01-schema.sql=$ROOT/supabase/schema.sql \
  --from-file=02-additive.sql=$ROOT/supabase/migrations/20261120_1_additive.sql \
  --from-file=03-restrict.sql=$ROOT/supabase/migrations/20261120_2_restrict.sql \
  --from-file=99-seed.sql=sql/99-seed.sql \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n agora-test create configmap agora-runner-script --from-file=runner.mjs=runner/runner.mjs --dry-run=client -o yaml | kubectl apply -f -
kubectl -n agora-test create configmap grafana-dashboard --from-file=agora.json=dashboard.json --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f agora-test.yaml
echo "파드가 준비되길 기다리는 중 (처음엔 이미지 내려받느라 몇 분 걸릴 수 있어요)…"
kubectl -n agora-test rollout status statefulset/agora-db --timeout=300s
for d in agora-api prometheus grafana; do kubectl -n agora-test rollout status deploy/$d --timeout=300s; done
kubectl -n agora-test get pods -o wide
echo
echo "준비 끝. 다음: ./k8s/agora-test/run.sh"
