#!/usr/bin/env bash
# A7 권한 + A8 응답 시간·동시 저장·DB 파드 삭제 시험. Grafana: http://localhost:3030
set -uo pipefail
cd "$(dirname "$0")"
OUT=${PW_OUT:-/tmp/agora-e2e}; mkdir -p "$OUT"
kubectl -n agora-test create configmap agora-runner-script --from-file=runner.mjs=runner/runner.mjs --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl -n agora-test delete job agora-runner --ignore-not-found >/dev/null
# Grafana 를 브라우저로 보려고 포트 연결 (이미 떠 있으면 그대로)
if ! (exec 3<>/dev/tcp/127.0.0.1/3030) 2>/dev/null; then
  nohup kubectl -n agora-test port-forward svc/grafana 3030:3000 >/tmp/agora-grafana-pf.log 2>&1 &
  echo "Grafana: http://localhost:3030 (시험 도중 열어 두세요)"
fi
kubectl apply -f runner-job.yaml >/dev/null
kubectl -n agora-test wait --for=condition=Ready pod -l app=agora-runner --timeout=180s >/dev/null
kubectl -n agora-test logs -f job/agora-runner | tee "$OUT/k8s-run.log" | grep -v '^RESULT_JSON'
grep '^RESULT_JSON ' "$OUT/k8s-run.log" | sed 's/^RESULT_JSON //' > "$OUT/k8s-results.json"
echo
echo "결과 파일: $OUT/k8s-results.json"
kubectl -n agora-test get pods
