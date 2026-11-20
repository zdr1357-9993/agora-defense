// 운영 빌드(dist) 점검: QA 전용 경로와 비밀값이 섞여 나가지 않았는지 확인한다.
// 사용: node scripts/check-prod-bundle.mjs [dist폴더]   (실패 시 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || 'dist';
if (!fs.existsSync(root)) { console.error(`BLOCKED: ${root} 이 없습니다 (빌드 먼저)`); process.exit(2); }

const rules = [
  { name: 'QA 경로 qa-screen', re: /qa-screen/ },
  { name: 'QA 경로 boss-preview', re: /boss-preview/ },
  { name: 'JWT 형태 토큰', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase 비밀 키', re: /sb_secret_[A-Za-z0-9_-]+|service_role/ },
  { name: '개인 키', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: '계정 해시 목록', re: /hash\s*:\s*['"][a-f0-9]{16,}['"]/ },
];
// 공개해도 되는 값 (브라우저용 공개 키)
const allow = [/sb_publishable_[A-Za-z0-9_-]+/g];

const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(js|html|css|json|map)$/.test(p) && files.push(p); } };
walk(root);

let hits = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  for (const a of allow) s = s.replace(a, '');
  for (const r of rules) {
    const m = s.match(r.re);
    if (m) { hits++; console.log(`FAIL ${r.name}: ${path.relative(root, f)} → ${m[0].slice(0, 40)}…`); }
  }
}
if (hits) { console.log(`\n운영 번들 점검 실패: ${hits}건`); process.exit(1); }
console.log(`PASS 운영 번들 점검: 파일 ${files.length}개, QA 경로·비밀값 0건`);
