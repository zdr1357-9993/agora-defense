# 철학사 랜덤 디펜스 (Project AGORA)

철학자 50인을 소환·조합해 도그마를 논파하는 모바일 웹 랜덤 디펜스 프로토타입.

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
```

## 데이터
- 원본은 `data/agora_master.xlsx` 하나. 엑셀만 수정하면 됨.
- `npm run dev` / `npm run build` 때 자동으로 `src/data/*.json`으로 변환되고, 잘못된 ID 참조가 있으면 빌드가 멈춤.

## 구조
- `src/game.ts` 전투 규칙 (웨이브, 공격, 조합)
- `src/main.ts` 화면 그리기와 터치 입력
- `src/data.ts` 등급별 전투 수치 (밸런스 조정 위치)

## 현재 범위 (v0.1)
1성 랜덤 소환 · 탭으로 이동/스왑 · 촉매 없는 조합식 원터치 연성 · 10웨이브(10R 보스) · 1x/2x/3x 배속
