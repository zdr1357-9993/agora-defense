#!/usr/bin/env bash
# 다 쓰고 버리기: 네임스페이스째 지운다 (DB 디스크·비밀키·대시보드 전부)
pkill -f "port-forward svc/grafana" 2>/dev/null || true
kubectl delete namespace agora-test
