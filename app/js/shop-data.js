// 상점 품목: 돈구리가 지니는 액세서리 4개와 저축 소품 4개.
const item = (id, kind, name, price, line) => ({ id, kind, name, price, line, img: `assets/items/${id}.webp` });

export const SHOP = [
  item('acc-leaf', 'acc', '행운의 은행잎', 20, '첫 은행잎을 모은 기념이에요.'),
  item('acc-norigae', 'acc', '기억의 노리개', 45, '오늘 아낀 돈을 잊지 않게 해 줘요.'),
  item('acc-mirror', 'acc', '교감의 거울', 70, '내 소비를 비춰 보는 거울이에요.'),
  item('acc-gat', 'acc', '안식의 갓', 120, '목표를 향해 차분히 걷는 선비의 갓.'),
  item('obj-piggy', 'obj', '황금 돼지 저금통', 30, '아낀 돈이 쏙쏙 들어가는 저금통.'),
  item('obj-purse', 'obj', '동전 지갑', 60, '용돈을 똑똑하게 나눠 담아요.'),
  item('obj-flag', 'obj', '목표 깃발', 90, '목표를 이룬 날 꽂는 깃발이에요.'),
  item('obj-calc', 'obj', '황금 계산기', 150, '경제 퀴즈 박사에게 어울려요.'),
];

export const byId = (id) => SHOP.find((i) => i.id === id);
