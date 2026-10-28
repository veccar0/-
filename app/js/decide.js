// 살까 말까 판단 카드 계산. 화면과 저장소를 모르는 순수 함수만 둔다.
// 숫자는 모두 롤링 한도 엔진(budget.js)에서 나오고, 여기서는 "샀다면 / 참았다면"을 비교한다.
import { addDays, dayStatus, goalProgress, cycleRange } from './budget.js';

// 자주 고민하는 물건 칩(기획서 v3 초안). 금액은 사용자가 고치면 그 금액을 기억한다.
export const CHIPS = [
  { name: '편의점 음료', amount: 2000, cat: 'cafe' },
  { name: '간식', amount: 1500, cat: 'snack' },
  { name: '떡볶이', amount: 4000, cat: 'friends' },
  { name: '마라탕', amount: 9000, cat: 'friends' },
  { name: '게임 아이템', amount: 5000, cat: 'etc' },
  { name: '다이소', amount: 5000, cat: 'shopping' },
];
const FOOD = ['friends', 'snack', 'cafe'];
export const isFood = (cat) => FOOD.includes(cat);

export const TREE_STAGES = ['새싹', '어린 나무', '큰 나무', '열매'];
const won = (n) => `${Math.max(0, Math.round(n)).toLocaleString('ko-KR')}원`;

// 받침에 맞는 조사: 이/가, 로/으로
const batchim = (word) => {
  const c = String(word).trim().slice(-1).charCodeAt(0) - 0xAC00;
  return c >= 0 && c <= 11171 ? c % 28 : 0;
};
export const iGa = (w) => `${w}${batchim(w) ? '이' : '가'}`;
export const ro = (w) => { const b = batchim(w); return `${w}${b && b !== 8 ? '으로' : '로'}`; };

export function chipList(prefs = {}) {
  return CHIPS.map((c, i) => ({ ...c, amount: prefs[c.name]?.amount ?? c.amount, count: prefs[c.name]?.count ?? 0, i }))
    .sort((a, b) => b.count - a.count || a.i - b.i);
}

// 지금 속도(주기마다 자동 저축)로 남은 금액을 모으는 데 걸리는 날 수. 저축이 0이면 알 수 없음(null).
export function goalDays(remaining, settings, cycleLen) {
  if (remaining <= 0) return 0;
  if (!(settings.savePerCycle > 0)) return null;
  return Math.ceil((remaining * cycleLen) / settings.savePerCycle);
}

const inCycle = (state, today) => {
  const { start } = cycleRange(state.settings, today);
  return (d) => d && d >= start && d <= today;
};
const worriesOf = (state) => state.worries || [];

// 이번 주기에 "참을래"(또는 보류 후 안 삼)로 지킨 돈. 고를 때 남아 있던 돈까지만 친다.
export function keptThisCycle(state, today) {
  const ok = inCycle(state, today);
  return worriesOf(state).filter((w) => w.outcome === 'skip' && ok(w.resolvedOn)).reduce((t, w) => t + (w.kept ?? w.amount), 0);
}

// 은행나무: 저축통 + 이번 주기에 지킨 돈(아직 남아 있는 만큼만)으로 자란다.
export function treeOf(state, today) {
  const g = goalProgress(state);
  const st = dayStatus(state, today);
  const kept = Math.min(keptThisCycle(state, today), Math.max(0, st.cycleLeft));
  const saved = g.saved + kept;
  const ratio = g.amount > 0 ? Math.min(1, saved / g.amount) : 0;
  const stage = ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.25 ? 1 : 0;
  return { saved, kept, ratio, stage, name: TREE_STAGES[stage], days: goalDays(g.remaining, state.settings, st.cycle.days) };
}

// 참을래로 새로 지키는 돈과 은행잎.
// 이번 주기에 남은 돈 중 아직 "지킨 돈"으로 세지 않은 만큼만 지킬 수 있다(같은 돈을 두 번 세지 않음).
// 은행잎은 이번 주기에 지킨 돈이 1,000원을 넘을 때마다 1장. 그래서 한 주기 은행잎은 쓸 돈 ÷ 1,000장을 넘지 못한다.
// 같은 물건은 하루 2번까지만 센다.
export function keepClaim(state, today, name, amount) {
  const same = worriesOf(state).filter((w) => w.resolvedOn === today && w.name === name && w.outcome === 'skip').length;
  const before = keptThisCycle(state, today);
  const free = Math.max(0, dayStatus(state, today).cycleLeft - before);
  if (same >= 2) return { kept: 0, leaves: 0, reason: 'same', free, toNext: 0 };
  const kept = Math.min(amount, free);
  const leaves = Math.floor((before + kept) / 1000) - Math.floor(before / 1000);
  const reason = free === 0 ? 'empty' : leaves === 0 ? 'small' : null;
  return { kept, leaves, reason, free, toNext: 1000 - ((before + kept) % 1000) };
}

// 같은 음식/물건 묶음에서 더 싼 칩 하나
function altFor(item, left, prefs) {
  const pool = chipList(prefs).filter((c) => c.name !== item.name && isFood(c.cat) === isFood(item.cat) && c.amount < item.amount);
  if (!pool.length) return null;
  const alt = pool.reduce((a, b) => (b.amount > a.amount ? b : a));
  return { name: alt.name, amount: alt.amount, fits: alt.amount <= left, gap: alt.amount - left };
}

export function judge(state, today, item) {
  const { name, amount, cat } = item;
  const st = dayStatus(state, today);
  const left = Math.max(0, st.cycleLeft);
  const tomorrow = addDays(today, 1);
  const nextCycle = tomorrow > st.cycle.end;
  const tomorrowNow = dayStatus(state, tomorrow).limit;
  const bought = { ...state, entries: [...state.entries, { date: today, type: 'spend', amount }] };
  const tomorrowBuy = nextCycle ? tomorrowNow : dayStatus(bought, tomorrow).limit;
  const g = goalProgress(state);
  const len = st.cycle.days;
  const over = Math.max(0, amount - left);
  const claim = keepClaim(state, today, name, amount);
  const keep = claim.kept;
  const wallet = st.cycleLeft + g.saved;
  const goalNow = goalDays(g.remaining, state.settings, len);
  const goalBuy = goalDays(g.remaining + over, state.settings, len);
  const goalKeep = goalDays(Math.max(0, g.remaining - keep), state.settings, len);
  const ok = inCycle(state, today);
  return {
    name, amount, cat,
    left, over, keep, weekAfterBuy: Math.max(0, left - amount),
    nextCycle, tomorrowNow, tomorrowBuy,
    goalName: state.settings.goalName, goalNow, goalBuy, goalKeep,
    later: goalNow === null ? null : goalBuy - goalNow,
    sooner: goalNow === null ? null : goalNow - goalKeep,
    leaves: claim.leaves, leafReason: claim.reason, toNext: claim.toNext,
    canBuy: amount <= wallet, short: Math.max(0, amount - wallet),
    repeat: worriesOf(state).filter((w) => w.name === name && ok(w.date)).length,
    alt: altFor(item, left, state.chipPrefs),
    unit: state.settings.cycle === 'monthly' ? '달' : '주',
  };
}

// 돈구리 한마디(규칙). 허용형으로 시작하고, 기억 하나 + 대안 하나만 말한다.
export function ruleLine(card) {
  if (!card.canBuy) {
    return `지금 가진 돈(이번 ${card.unit} 남은 돈과 저축통)보다 ${won(card.short)} 많아서 아직은 못 사. 정말 갖고 싶으면 목표로 정해서 같이 모아 보자!`;
  }
  const parts = [isFood(card.cat) ? '먹어도 돼!' : '사도 돼!'];
  if (card.repeat >= 2) parts.push(`이번 ${card.unit} ${card.name}만 ${card.repeat + 1}번째 고민이야.`);
  if (card.over === 0) {
    parts.push(`사고 나면 이번 ${card.unit} ${won(card.left - card.amount)} 남아.`);
    if (card.sooner > 0) parts.push(`참으면 ${iGa(card.goalName)} ${card.sooner}일 당겨져.`);
    return parts.join(' ');
  }
  parts.push(card.later > 0
    ? `근데 이번 ${card.unit} 쓸 돈보다 ${won(card.over)} 많아서 ${iGa(card.goalName)} ${card.later}일 늦어져.`
    : `근데 이번 ${card.unit} 쓸 돈보다 ${won(card.over)} 많아서 그만큼 저축에서 빠져.`);
  const a = card.alt;
  if (a && a.fits) parts.push(`${ro(a.name)} 바꾸면 딱 맞아.`);
  else if (a && a.gap <= 1000) parts.push(`${ro(a.name)} 바꾸면 ${won(a.gap)}만 넘어.`);
  else if (card.amount / 2 <= card.left) parts.push('반만 쓰면 목표는 그대로야.');
  else parts.push('하루 기다려 보고 정해도 돼.');
  return parts.join(' ');
}

// 기록 탭: 이번 주기의 고민 통계
export function weekStats(state, today) {
  const ok = inCycle(state, today);
  const list = worriesOf(state).filter((w) => ok(w.date)).slice().reverse();
  const decided = list.filter((w) => w.outcome);
  const kept = decided.filter((w) => w.outcome === 'skip');
  const counts = {};
  list.forEach((w) => { counts[w.name] = (counts[w.name] || 0) + 1; });
  const topName = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  return {
    list, count: list.length, kept: kept.length,
    ratio: decided.length ? kept.length / decided.length : 0,
    keptMoney: kept.reduce((t, w) => t + (w.kept ?? w.amount), 0),
    top: topName && counts[topName] > 1 ? { name: topName, n: counts[topName] } : null,
  };
}
