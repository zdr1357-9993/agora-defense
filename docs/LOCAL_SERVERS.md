# 개발·스테이지 서버

- 개발: `scripts/dev-server.sh start|stop|restart|status` — Vite HMR, `127.0.0.1:5173`.
- 스테이지: `npm run build:stage`로 `dist-stage/`를 별도 생성한 뒤 `scripts/stage-server.sh start|stop|restart|status` — Vite Preview, `127.0.0.1:4173`.
- 각각 PID와 로그를 `${TMPDIR:-/tmp}/agora-defense-{dev,stage}.{pid,log}`에 둬 독립적으로 관리한다. 스테이지는 코드 변경을 자동 반영하지 않으며 재빌드 후 별도 재시작한다.
- 셸 세션에 붙여서 계속 실행할 때는 `scripts/dev-server.sh session` 또는 `scripts/stage-server.sh session`을 사용한다. 각 세션을 종료하지 않고 다른 셸에서 `stop`, `restart`, `status`를 실행할 수 있다.
- 서비스는 AI-DECK의 기존 localhost + Windows Tailscale portproxy 방식에 맞춰 loopback에서만 수신한다. 직접 원격 URL을 쓰려면 Windows 관리자 PowerShell에서 Tailscale IP에 한정한 TCP 전달 규칙이 필요하다. 공개 Pages 배포나 공유기 설정은 사용하지 않는다.
