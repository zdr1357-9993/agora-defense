# 파스텔 도트 디자인 · 버전 관리

## 복구 지점

- 변경 전 커밋: `36c9e9a`
- 변경 전 브랜치 및 태그: `backup/pre-pastel-dot-20261108`
- 디자인 작업 브랜치: `design/pastel-dot`
- 디자인 첫 적용 태그: `design/pastel-dot-v1`

원본 `main`은 그대로 보존한다. 백업 이름과 태그를 이동하거나 덮어쓰지 않는다.
위 브랜치와 태그는 원격에 push하기 전까지 로컬 Git에만 존재한다.

## 변경 범위

- 라벤더 바탕, 민트·핑크 버튼, 얇은 패널 테두리로 공통 UI 정리
- 무거운 클레이 그림자와 반복 발광 완화
- 여정: 작은 도트 풍경, 현재 위치, 기억 진행도, 짧은 B급 문구
- 전투: 실제 7×7 격자와 일치하는 5×5 배치 영역 시각화
- 기존 도트 캐릭터 유지, 피부·일부 의상·외곽선 색감 조정
- 새 배경은 코드로 생성하며 외부 이미지 파일을 내려받지 않음
- 밸런스·세이브 포맷·계정 로직은 수정하지 않음

## 실행

```sh
npm ci
npm run dev
npm run build
```

## 검증 기록

- TypeScript 검사와 Vite 프로덕션 빌드 통과
- 임시 DOM/Canvas 환경에서 캐릭터 80종 및 각 6개 스킨 생성 확인
- 5시대 여정 배경·전투 바닥 생성 확인
- 앱 초기화, 여정 25개 노드, 메뉴 5개 전환 확인
- 5시대 전투 진입·소환 버튼·Canvas 렌더링 확인
- 실제 브라우저는 로컬 서버에 연결할 수 없어 시각적 배치와 터치 검수는 미완료
- GitHub 연결 전이므로 원격 브랜치 생성·PR·실서비스 배포는 미완료

## GitHub에 반영

GitHub 쓰기 권한을 가진 환경에서 먼저 원본 백업을 올린다.

```sh
git push origin backup/pre-pastel-dot-20261108
git push origin refs/tags/backup/pre-pastel-dot-20261108
git push -u origin design/pastel-dot
git push origin refs/tags/design/pastel-dot-v1
```

`design/pastel-dot`에서 `main`으로 Pull Request를 만들고 화면을 검수한 뒤 병합한다.
기존 배포 워크플로는 `main` 반영 시 실행된다.

## 이전 디자인 확인 및 복구

별도 폴더에서 이전 버전을 확인한다. 작업 중인 수정 파일에 영향을 주지 않는다.

```sh
git worktree add ../agora-before-pastel backup/pre-pastel-dot-20261108
```

디자인 커밋을 main에 반영한 뒤 되돌릴 때는 history를 지우는 reset 대신 revert를 사용한다.
일반 merge로 디자인 커밋이 보존된 경우:

```sh
git switch main
git pull --ff-only
git revert design/pastel-dot-v1
git push origin main
```

PR을 squash merge했다면 위 태그 대신 GitHub PR의 squash 커밋을 revert한다.
Git 복구는 코드만 되돌리며, 플레이어의 브라우저/서버 진행 기록을 백업하거나 복원하지 않는다.

## Git bundle로 인계받은 경우

이 저장소와 백업을 한 파일로 전달할 수 있다. 새 폴더에 복구할 때:

```sh
git clone -b design/pastel-dot agora-defense-pastel.bundle agora-defense-pastel
cd agora-defense-pastel
git remote rename origin bundle-source
git remote add origin https://github.com/zdr1357-9993/agora-defense.git
git branch backup/pre-pastel-dot-20261108 refs/tags/backup/pre-pastel-dot-20261108
```

이후 위 push 명령으로 백업과 디자인 브랜치를 GitHub에 보존한다.
