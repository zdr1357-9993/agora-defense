// 사냥 중 떨어지는 소품 아이템. 주인(찰떡)에게 장착하면 효과가 커진다.
export interface Item { id: string; name: string; owners: string[]; desc: string }

export const ITEMS: Item[] = [
  { id: 'cup', name: '독배', owners: ['소크라테스'], desc: '아테네가 건넨 마지막 잔' },
  { id: 'watch', name: '회중시계', owners: ['임마누엘 칸트'], desc: '쾨니히스베르크 시민들이 시계를 맞춘 산책' },
  { id: 'hammer', name: '망치', owners: ['프리드리히 니체', '카를 마르크스'], desc: '우상을 부수고, 세계를 바꾼다' },
  { id: 'razor', name: '면도날', owners: ['오컴의 윌리엄'], desc: '불필요한 존재를 늘리지 마라' },
  { id: 'flybottle', name: '파리병', owners: ['루트비히 비트겐슈타인'], desc: '파리에게 나가는 길을 보여 주기' },
  { id: 'cigar', name: '시가', owners: ['지그문트 프로이트', '한나 아렌트'], desc: '생각에 잠길 때 늘 물고 있던 시가' },
  { id: 'pipe', name: '파이프', owners: ['장 폴 사르트르', '버트런드 러셀'], desc: '카페 드 플로르의 연기' },
  { id: 'mirror', name: '거울', owners: ['자크 라캉'], desc: '거울 속의 나' },
  { id: 'owl', name: '미네르바의 부엉이', owners: ['게오르크 헤겔'], desc: '황혼이 깃들어야 날개를 편다' },
  { id: 'lotus', name: '연꽃', owners: ['고타마 붓다', '혜능', '나가르주나'], desc: '진흙 속에서 피어난다' },
  { id: 'skull', name: '해골바가지', owners: ['원효'], desc: '모든 것은 마음이 지어낸다' },
  { id: 'book', name: '사서(四書)', owners: ['공자', '주희', '퇴계 이황'], desc: '배우고 때로 익히면' },
  { id: 'crane', name: '거중기', owners: ['다산 정약용'], desc: '백성을 위한 학문' },
  { id: 'axe', name: '숲길의 도끼', owners: ['마르틴 하이데거'], desc: '숲속 오두막에서 존재를 묻다' },
  { id: 'boulder', name: '시지프의 바위', owners: ['알베르 카뮈'], desc: '언덕 위로, 다시 또 언덕 위로' },
  { id: 'lantern', name: '디오게네스의 등불', owners: ['소크라테스', '미셸 푸코'], desc: '대낮에 사람을 찾아다닌 등불' },
];
export const ITEM = new Map(ITEMS.map((i) => [i.id, i]));

/** 장착 효과: 일반 공격력 +20%, 주인에게 장착하면 공격력 +60% · 사거리 +0.4 */
export const ITEM_BONUS = { dmg: 0.2, ownerDmg: 0.6, ownerRange: 0.4 };
/** 드랍 확률: 일반 적 4%, 보스 100% */
export const ITEM_DROP = { normal: 0.04, boss: 1 };

export const isOwner = (itemId: string, philName: string) => ITEM.get(itemId)?.owners.includes(philName) ?? false;
