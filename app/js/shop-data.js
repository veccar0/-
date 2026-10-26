// 상점 품목. 캐릭터가 확정되기 전까지 쓰는 임시 그림(SVG).
const S = (body) => `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${body}</svg>`;
const jacket = (main, trim) => S(`<path d="M22 10h20l12 8-5 12-5-3v27H20V27l-5 3-5-12z" fill="${main}" stroke="#3A2A12" stroke-width="2" stroke-linejoin="round"/><path d="M26 10l6 14 6-14" fill="none" stroke="${trim}" stroke-width="3" stroke-linejoin="round"/><path d="M32 24v30" stroke="${trim}" stroke-width="2"/>`);

const ART = {
  'acc-leaf': S('<path d="M32 56V36C19 36 9 25 10 12C18 8 27 11 32 19C37 11 46 8 54 12C55 25 45 36 32 36" fill="#F6CA51" stroke="#B98A12" stroke-width="2.5" stroke-linejoin="round"/>'),
  'acc-norigae': S('<path d="M32 6v14" stroke="#B98A12" stroke-width="2.5"/><circle cx="32" cy="24" r="6" fill="#F6CA51" stroke="#B98A12" stroke-width="2"/><path d="M24 32h16l-2 24h-12z" fill="#2BEED4" stroke="#16776A" stroke-width="2" stroke-linejoin="round"/><path d="M28 36v18M32 36v18M36 36v18" stroke="#16776A" stroke-width="1.5"/>'),
  'acc-mirror': S('<ellipse cx="32" cy="24" rx="14" ry="17" fill="#E8F0FE" stroke="#B98A12" stroke-width="3"/><path d="M26 18l6-5" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M30 41h4v15h-4z" fill="#B98A12"/>'),
  'acc-gat': S('<ellipse cx="32" cy="42" rx="26" ry="7" fill="#2A2A2A" opacity=".85"/><path d="M22 41V22q0-6 10-6t10 6v19z" fill="#3A3A3A"/><path d="M20 44q12 14 24 0" fill="none" stroke="#B98A12" stroke-width="1.5"/>'),
  'hanbok-walk': jacket('#F3EBDD', '#8B6A3E'),
  'hanbok-train': jacket('#5B6B78', '#2A333B'),
  'hanbok-festival': jacket('#F6CA51', '#E5484D'),
  'hanbok-scholar': jacket('#26355E', '#B98A12'),
};

const item = (id, kind, name, price, line) => ({ id, kind, name, price, line, art: ART[id] });

export const SHOP = [
  item('acc-leaf', 'acc', '행운의 은행잎', 20, '첫 은행잎을 모은 기념이에요.'),
  item('acc-norigae', 'acc', '기억의 노리개', 45, '오늘 아낀 돈을 잊지 않게 해 줘요.'),
  item('acc-mirror', 'acc', '교감의 거울', 70, '내 소비를 비춰 보는 거울이에요.'),
  item('acc-gat', 'acc', '안식의 갓', 120, '목표를 향해 차분히 걷는 선비의 갓.'),
  item('hanbok-walk', 'hanbok', '산책 한복', 30, '가볍게 숲을 거닐 때 입어요.'),
  item('hanbok-train', 'hanbok', '수련 한복', 60, '꾸준히 기록하는 날을 위한 옷.'),
  item('hanbok-festival', 'hanbok', '축제 한복', 90, '목표를 이룬 날 입는 고운 옷.'),
  item('hanbok-scholar', 'hanbok', '학자 한복', 150, '경제 퀴즈 박사에게 어울려요.'),
];

export const byId = (id) => SHOP.find((i) => i.id === id);
