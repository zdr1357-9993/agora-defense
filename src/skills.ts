// 철학자 스킬 엔진: 유형 + 수치로 정의하고, 설명문은 자동 생성한다.
export type SkillKind =
  | 'auraAtk' | 'auraSpeed'       // 주변(8칸) 아군 공격력 / 공격속도
  | 'slow' | 'stun'               // 맞은 적 둔화 / 확률 기절
  | 'splash' | 'chain' | 'multi'  // 광역 / 연쇄 / 확률 추가 타격
  | 'crit' | 'third'              // 확률 치명(×2) / N타마다 강타
  | 'boss' | 'execute' | 'vuln'   // 보스 특효 / 체력 낮은 적 처형 / 받는 피해 증가
  | 'dot' | 'stack' | 'gold'      // 지속 피해 / 누적 강화 / 처치 골드
  | 'lonely' | 'globalSlow';      // 홀로 설 때 강해짐 / 맵 전체 둔화

export interface Skill { kind: SkillKind; v: number; v2?: number }

const S = (kind: SkillKind, v: number, v2?: number): Skill => ({ kind, v, v2 });

export const SKILLS: Record<string, Skill> = {
  // 1성
  탈레스: S('auraSpeed', 0.1), 헤라클레이토스: S('crit', 0.25), 피타고라스: S('auraAtk', 0.08),
  플라톤: S('splash', 0.5), 아리스토텔레스: S('third', 3, 2), 노자: S('slow', 0.25),
  // 2성
  '오컴의 윌리엄': S('execute', 0.12), 아우구스티누스: S('stack', 0.02), '르네 데카르트': S('crit', 0.3),
  '바뤼흐 스피노자': S('auraAtk', 0.12), 장자: S('multi', 0.2), 나가르주나: S('chain', 1), 원효: S('auraSpeed', 0.12),
  // 3성
  '데이비드 흄': S('stun', 0.12), '고트프리트 라이프니츠': S('chain', 2), '게오르크 헤겔': S('third', 3, 3),
  '에드문트 후설': S('vuln', 0.15), '아르투어 쇼펜하우어': S('dot', 0.02), '버트런드 러셀': S('stun', 0.15), 주희: S('stack', 0.03),
  // 4성
  '프리드리히 니체': S('crit', 0.4), '지그문트 프로이트': S('vuln', 0.2), '카를 마르크스': S('gold', 4),
  '고틀로프 프레게': S('boss', 0.5), '쇠렌 키르케고르': S('lonely', 1), '퇴계 이황': S('auraAtk', 0.15), 혜능: S('crit', 0.3),
  // 5성
  '마르틴 하이데거': S('globalSlow', 0.2), '루트비히 비트겐슈타인': S('chain', 3), '장 폴 사르트르': S('multi', 0.35),
  '자크 라캉': S('vuln', 0.3), '미셸 푸코': S('vuln', 0.25), '한나 아렌트': S('auraSpeed', 0.2), '질 들뢰즈': S('splash', 0.8),
  '에마뉘엘 레비나스': S('boss', 0.7), '테오도어 아도르노': S('splash', 0.6), '니시다 기타로': S('auraAtk', 0.25),
  '다산 정약용': S('boss', 0.6), 바울: S('auraAtk', 0.3),
  // 6성
  '델포이의 소크라테스': S('auraAtk', 0.35), '임마누엘 칸트': S('globalSlow', 0.3), '자크 데리다': S('execute', 0.2),
  '대성지성 공자': S('auraAtk', 0.4), '고타마 붓다': S('auraSpeed', 0.35), 예수: S('auraAtk', 0.5),
  '알베르 카뮈': S('stack', 0.04),
  // v2 조합표로 새로 들어온 철학자
  '파르메니데스': S('slow', 0.2),
  '데모크리토스': S('splash', 0.35),
  소크라테스: S('vuln', 0.1),
  공자: S('auraAtk', 0.06),
  '싯다르타': S('dot', 0.012),
  '아낙시만드로스': S('chain', 1),
  '제논': S('slow', 0.35),
  '엠페도클레스': S('splash', 0.5),
  '아낙사고라스': S('crit', 0.2),
  '프로타고라스': S('gold', 2),
  '고르기아스': S('stun', 0.08),
  '디오게네스': S('lonely', 0.8),
  '에피쿠로스': S('auraSpeed', 0.1),
  '피론': S('stun', 0.1),
  '맹자': S('auraAtk', 0.1),
  '순자': S('stack', 0.02),
  '한비자': S('execute', 0.1),
  '마르쿠스 아우렐리우스': S('auraAtk', 0.12),
  '세네카': S('multi', 0.2),
  '루크레티우스': S('splash', 0.55),
  '키케로': S('vuln', 0.15),
  '플로티노스': S('chain', 2),
  '히파티아': S('third', 3, 2.5),
  '이븐 시나': S('auraSpeed', 0.15),
  '이븐 루시드': S('third', 4, 3),
  '토마스 아퀴나스': S('auraAtk', 0.18),
  '니콜로 마키아벨리': S('gold', 4),
  '미셸 드 몽테뉴': S('multi', 0.25),
  '토머스 홉스': S('stun', 0.15),
  '블레즈 파스칼': S('crit', 0.3),
  '존 로크': S('auraSpeed', 0.18),
  '왕양명': S('crit', 0.3),
  '장 자크 루소': S('globalSlow', 0.1),
  '존 스튜어트 밀': S('splash', 0.7),
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
export function describe(s: Skill | undefined): string {
  if (!s) return '';
  switch (s.kind) {
    case 'auraAtk': return `주변 아군 공격력 +${pct(s.v)}`;
    case 'auraSpeed': return `주변 아군 공격속도 +${pct(s.v)}`;
    case 'slow': return `맞은 적 이동속도 -${pct(s.v)} (1.5초)`;
    case 'stun': return `${pct(s.v)} 확률로 적 기절 (0.8초)`;
    case 'splash': return `주변 적에게 피해의 ${pct(s.v)} 광역 피해`;
    case 'chain': return `근처 적 ${s.v}명에게 연쇄 피해 (70%)`;
    case 'multi': return `${pct(s.v)} 확률로 한 번 더 공격`;
    case 'crit': return `${pct(s.v)} 확률로 치명타 (피해 ×2)`;
    case 'third': return `${s.v}타마다 피해 ×${s.v2}`;
    case 'boss': return `보스에게 주는 피해 +${pct(s.v)}`;
    case 'execute': return `체력 ${pct(s.v)} 이하 적 즉시 처형 (보스 제외)`;
    case 'vuln': return `맞은 적이 받는 모든 피해 +${pct(s.v)} (3초)`;
    case 'dot': return `맞은 적에게 초당 최대체력 ${pct(s.v)} 지속 피해 (3초)`;
    case 'stack': return `명중할 때마다 공격력 +${pct(s.v)} 누적 (최대 +100%)`;
    case 'gold': return `처치할 때마다 골드 +${s.v}`;
    case 'lonely': return `주변 8칸에 아군이 없으면 공격력 +${pct(s.v)}`;
    case 'globalSlow': return `맵의 모든 적 이동속도 -${pct(s.v)}`;
  }
}
