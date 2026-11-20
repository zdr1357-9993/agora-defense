# 친구 기능 권한 시험 제안

이 시험은 기본 테스트 명령에 넣지 않은 제안이다. `scripts/ci-db-security.sh` 와 같은 빈 Postgres/PostgREST 환경에서 마이그레이션 적용 후 실행한다. 운영 Supabase에는 절대 연결하지 않는다.

1. 시험 DB에 아래 `seed.sql` 을 적용해 A·B·M 계정을 만든다.
2. 시험용 PostgREST 주소와 같은 로컬 JWT 비밀을 환경 변수로 지정한다.
3. `node tests-proposed/friends/security.test.mjs` 를 실행한다.

예: `API_URL=http://127.0.0.1:3300 JWT_SECRET=<시험용 로컬 비밀> node tests-proposed/friends/security.test.mjs`

기대 결과: A와 M은 승인된 친구 관계를 볼 수 있고, 관계 없는 B에게는 해당 행이 보이지 않는다. B의 `last_seen` 직접 변경은 거부되며, A가 서버 시각으로 갱신한 값은 변하지 않는다.
