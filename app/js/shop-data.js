// 상점 품목. 그림은 캐릭터 시트에서 잘라 낸 것.
const item = (id, kind, name, price, line) => ({ id, kind, name, price, line, img: `assets/char/${id}.png` });

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
