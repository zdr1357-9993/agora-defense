# 환경과 GitHub 브랜치 운영

## 환경 구분

| 환경 | 브랜치 | 용도 | AI-DECK 주소 |
|---|---|---|---|
| 개발 | `develop` | Vite HMR로 빠르게 수정 | `http://100.105.168.91:5173/` |
| 스테이지 | `stage` | 빌드한 결과를 실제 플레이 검증 | `http://100.105.168.91:4173/` |
| 운영 | `main` | 공개 GitHub Pages | `https://zdr1357-9993.github.io/agora-defense/` |

`develop`과 `stage`는 GitHub에 코드를 보관하고 검증하는 브랜치다. 두 서버는 AI-DECK의 별도 Git worktree에서 각각 실행하며, 스테이지는 `stage` worktree의 빌드 산출물만 제공한다. GitHub Pages 배포는 기존대로 `main` push에서만 실행한다.

## 변경 흐름

1. `develop`에서 기능을 수정하고 개발 서버에서 확인한다.
2. 확인이 끝난 변경을 `develop`에서 `stage`로 PR 또는 fast-forward 반영한다.
3. 스테이지 서버에서 실제 플레이를 확인한다.
4. 운영 반영이 결정된 변경만 `stage`에서 `main`으로 PR한다. `main` 반영 전에는 공개 사이트가 바뀌지 않는다.

GitHub Actions의 `Validate game branches`는 `develop`·`stage` push와 `main` 대상 PR에서 타입 검사와 양쪽 빌드를 확인한다. 기존 Pages 배포 워크플로는 `main` push 전용이다.

## AI-DECK에서 두 worktree 준비

`develop` 브랜치의 저장소 루트에서 실행한다. 현재 checkout은 개발 환경으로 쓰고, 스테이지 worktree를 저장소 옆에 만든다. `main`에서 실행하면 두 worktree를 모두 별도로 만든다. 대상 폴더가 이미 있으면 스크립트는 덮어쓰지 않고 중단한다.

```bash
git fetch origin develop stage
scripts/setup-environments.sh
```

기본 worktree 위치는 저장소 옆의 `agora-defense-envs/develop`과 `agora-defense-envs/stage`다. 각 worktree에서 `npm ci` 후 `scripts/dev-server.sh start` 또는 `scripts/stage-server.sh start`로 독립 실행한다. 스테이지 코드를 바꾼 뒤에는 `scripts/stage-server.sh restart` 전에 `npm run build:stage`를 다시 실행한다.

서버 프로세스는 WSL loopback에서만 수신한다. 원격 Tailscale 접속은 Windows의 Tailscale IP에 한정한 portproxy와 `100.64.0.0/10` 원격 범위 방화벽 규칙이 준비되어야 한다. 공개 주소나 공유기 포트는 열지 않는다.
