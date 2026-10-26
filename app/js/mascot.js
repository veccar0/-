// 임시 마스코트. 돈구리 캐릭터가 확정되면 이 파일만 바꾸면 된다.
// mascot(mood)는 표정·자세가 다른 SVG 문자열을 돌려준다.
export const MOODS = ['calm', 'joy', 'surprise', 'rest', 'cheer', 'walk', 'think'];

const INK = '#3A2A12';
const BODY = '#FFE9A8';
const EDGE = '#D9A93A';
const LEAF = '#F6CA51';
const LEAF_EDGE = '#B98A12';

const eyes = {
  calm: `<path d="M41 70q6 5 12 0M67 70q6 5 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  joy: `<path d="M41 72q6-8 12 0M67 72q6-8 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  surprise: `<circle cx="47" cy="69" r="6" fill="${INK}"/><circle cx="73" cy="69" r="6" fill="${INK}"/><circle cx="49" cy="67" r="2" fill="#fff"/><circle cx="75" cy="67" r="2" fill="#fff"/>`,
  rest: `<path d="M41 71h12M67 71h12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  open: `<circle cx="47" cy="70" r="4.5" fill="${INK}"/><circle cx="73" cy="70" r="4.5" fill="${INK}"/><circle cx="48.5" cy="68.5" r="1.5" fill="#fff"/><circle cx="74.5" cy="68.5" r="1.5" fill="#fff"/>`,
  think: `<circle cx="47" cy="70" r="4.5" fill="${INK}"/><path d="M67 71q6 4 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M66 60l12-3" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
};
const mouths = {
  smile: `<path d="M53 83q7 6 14 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  open: `<path d="M51 81h18q-1 11-9 11t-9-11z" fill="#E5484D" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
  o: `<ellipse cx="60" cy="86" rx="5" ry="6" fill="#E5484D" stroke="${INK}" stroke-width="2.5"/>`,
  flat: `<path d="M55 85h10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
};
const arms = {
  down: `<path d="M24 82q-6 8-2 14M96 82q6 8 2 14" stroke="${EDGE}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  up: `<path d="M26 70q-12-10-10-24M94 70q12-10 10-24" stroke="${EDGE}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  wave: `<path d="M24 82q-6 8-2 14M95 72q12-6 14-20" stroke="${EDGE}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
};

const FACE = {
  calm: ['calm', 'smile', 'down'],
  joy: ['joy', 'open', 'down'],
  surprise: ['surprise', 'o', 'down'],
  rest: ['rest', 'flat', 'down'],
  cheer: ['joy', 'open', 'up'],
  walk: ['open', 'smile', 'wave'],
  think: ['think', 'flat', 'down'],
};

const sprout = `<path d="M60 38V27" stroke="${LEAF_EDGE}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M60 28C53 28 48 22 49 15C53 13 57 15 60 19C63 15 67 13 71 15C72 22 67 28 60 28Z" fill="${LEAF}" stroke="${LEAF_EDGE}" stroke-width="2" stroke-linejoin="round"/>`;

export function mascot(mood = 'calm', size = 120, label = '돈구리(임시 그림)') {
  const [e, m, a] = FACE[mood] || FACE.calm;
  const zz = mood === 'rest' ? `<text x="88" y="40" font-size="14" font-weight="700" fill="${LEAF_EDGE}" font-family="sans-serif">z z</text>` : '';
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${label}"><ellipse cx="60" cy="112" rx="30" ry="4" fill="rgba(80,60,20,.12)"/>${arms[a]}<ellipse cx="60" cy="74" rx="38" ry="35" fill="${BODY}" stroke="${EDGE}" stroke-width="3"/>${sprout}<circle cx="38" cy="81" r="5" fill="#FFB4A2" opacity=".7"/><circle cx="82" cy="81" r="5" fill="#FFB4A2" opacity=".7"/>${eyes[e]}${mouths[m]}${zz}</svg>`;
}
