// 앱 상태: 기기 저장, 날짜 넘김 처리, 고민(살래·참을래·보류)과 기록, 시연 데이터.
import { ymd, addDays, diffDays, weekday, cycleRange, dayStatus, goalProgress } from './budget.js';
import { keepClaim } from './decide.js';

const KEY = 'dongguri-v1';
const HOLD_DAYS = 3;

export const blankState = () => ({
  version: 1,
  devOffset: 0,
  settings: null,
  startDate: null,
  lastDay: null,
  entries: [],
  autoSaved: 0,
  savedCycles: [],
  leaves: 0,
  rewardLog: [],
  worries: [],
  chipPrefs: {},
  quiz: { date: null, answered: {} },
  wrong: [],
  inventory: [],
  equipped: { acc: null, obj: null },
  coachKey: '',
});

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

let fallback = memoryStorage();
export function defaultStorage() {
  try {
    const t = '__dongguri_test__';
    globalThis.localStorage.setItem(t, '1');
    globalThis.localStorage.removeItem(t);
    return globalThis.localStorage;
  } catch {
    return fallback;
  }
}

export function load(storage = defaultStorage()) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return blankState();
    const { chat, ...rest } = JSON.parse(raw);
    return { ...blankState(), ...rest };
  } catch {
    return blankState();
  }
}

export function save(state, storage = defaultStorage()) {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장이 막혀도 화면은 계속 동작 */ }
}

export const todayOf = (state, now = new Date()) => addDays(ymd(now), state.devOffset || 0);

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

// 주기가 바뀔 때: 지난 주기에 남은 돈은 저축통으로, 넘친 돈은 저축통에서 꺼낸다. 그다음 이번 주기 저축.
function applyCycle(state, today, events) {
  const { start } = cycleRange(state.settings, today);
  if (state.savedCycles.includes(start)) return;
  const prevEnd = addDays(start, -1);
  if (state.savedCycles.length && prevEnd >= state.startDate) {
    const left = dayStatus(state, prevEnd).cycleLeft;
    if (left !== 0) {
      state.autoSaved = Math.max(0, state.autoSaved + left);
      events.push({ type: left > 0 ? 'leftover' : 'overdraw', amount: Math.abs(left) });
    }
  }
  state.autoSaved += state.settings.savePerCycle;
  state.savedCycles.push(start);
  if (state.savedCycles.length > 1) events.push({ type: 'cycle', amount: state.settings.savePerCycle });
}

export function setupBudget(state, settings, today) {
  state.settings = { ...settings };
  if (!state.startDate) state.startDate = today;
  state.lastDay = today;
  applyCycle(state, today, []);
  return state;
}

// 마지막으로 연 날부터 오늘까지 주기를 넘기고, 3일 동안 답이 없던 보류는 "안 산 것"으로 처리한다.
// 여러 번 불러도 같은 결과.
export function newDay(state, today) {
  const events = [];
  if (!state.settings) return events;
  const from = state.lastDay && state.lastDay > state.startDate ? state.lastDay : state.startDate;
  for (let d = from; d <= today; d = addDays(d, 1)) applyCycle(state, d, events);
  for (const w of pendingHolds(state, today)) {
    if (diffDays(w.date, today) < HOLD_DAYS) continue;
    settle(state, today, w, 'skip');
    w.auto = true;
    events.push({ type: 'autokeep', name: w.name, leaves: w.leaves });
  }
  state.lastDay = today;
  return events;
}

// 지금 가진 돈: 이번 주기에 남은 돈 + 저축통. 이보다 많이 쓰는 기록은 받지 않는다(돈이 마이너스가 되지 않게).
export const walletOf = (state, today) => dayStatus(state, today).cycleLeft + goalProgress(state).saved;
export const canSpend = (state, today, amount) => amount > 0 && amount <= walletOf(state, today);

export function record(state, today, amount, category, memo = '') {
  const e = { id: newId(), date: today, type: 'spend', amount, category, memo };
  state.entries.push(e);
  return e;
}

// 용돈 말고 추가로 받은 돈
export function receive(state, today, amount, memo = '') {
  const e = { id: newId(), date: today, type: 'income', amount, memo };
  state.entries.push(e);
  return e;
}

// 지우면 돈이 마이너스가 되는 기록(이미 쓴 받은 돈)은 지울 수 없다.
export function canRemove(state, today, id) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return false;
  if (e.type !== 'income') return true;
  return walletOf({ ...state, entries: state.entries.filter((x) => x.id !== id) }, today) >= 0;
}

export function saveMoney(state, today, amount) {
  const e = { id: newId(), date: today, type: 'save', amount };
  state.entries.push(e);
  return e;
}

export function removeEntry(state, id) {
  state.entries = state.entries.filter((e) => e.id !== id);
}

function settle(state, today, w, outcome) {
  if (outcome === 'skip') {
    const c = keepClaim(state, today, w.name, w.amount);
    w.kept = c.kept;
    w.leaves = c.leaves;
    state.leaves += w.leaves;
    if (w.leaves) state.rewardLog.push({ date: today, action: 'keep', amount: w.leaves });
  } else {
    if (!canSpend(state, today, w.amount)) return false;
    w.entryId = record(state, today, w.amount, w.cat, w.name).id;
  }
  w.outcome = outcome;
  w.resolvedOn = today;
  return true;
}

// 판단 카드에서 고른 결과를 남긴다. choice: 'buy' 살래 · 'skip' 참을래 · 'hold' 내일 다시 볼래
export function worry(state, today, item, choice) {
  const w = { id: newId(), date: today, name: item.name, amount: item.amount, cat: item.cat || 'etc', choice, outcome: null, resolvedOn: null, leaves: 0 };
  if (choice !== 'hold' && !settle(state, today, w, choice)) return null;
  state.worries.push(w);
  const p = state.chipPrefs[item.name];
  state.chipPrefs[item.name] = { amount: item.amount, count: (p?.count || 0) + 1 };
  return w;
}

export const pendingHolds = (state, today) => state.worries.filter((w) => w.choice === 'hold' && !w.outcome && w.date < today);

export function resolveHold(state, today, id, outcome) {
  const w = state.worries.find((x) => x.id === id);
  if (!w || w.outcome) return null;
  return settle(state, today, w, outcome) ? w : null;
}

// 시연용 김도연의 2주. 날짜는 오늘 기준으로 만든다.
const DEMO_SETTINGS = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000, goalDate: null };
// 오늘로부터 며칠 전, [금액, 카테고리, 이름, 고민 끝에 샀는지]
const DEMO_DAYS = [
  [13, [[3000, 'friends', '떡볶이', true]]],
  [12, []],
  [11, [[1500, 'cafe', '편의점 음료', true]]],
  [10, []],
  [9, []],
  [8, [[1200, 'snack', '간식', true]]],
  [7, []],
  [6, [[2000, 'shopping', '다이소', true]]],
  [5, []],
  [4, [[300, 'snack', '사탕', true]]],
  [3, []],
  [2, [[300, 'cafe', '우유', true]]],
  [1, []],
];
// 참은 고민: [며칠 전, 이름, 금액, 카테고리]
const DEMO_KEPT = [[12, '마라탕', 9000, 'friends'], [10, '게임 아이템', 5000, 'etc'], [7, '노래방', 4500, 'friends'], [6, '간식', 1500, 'snack']];

export function demoState(today) {
  const s = blankState();
  const start = addDays(today, -13);
  s.startDate = start;
  // 시연하는 날이 언제든 용돈 주기 5일째가 되도록 받는 요일을 맞춘다.
  // 쓰는 요일은 시연하는 날(금요일 이야기)과 다음 날(토요일)로 맞춘다.
  setupBudget(s, { ...DEMO_SETTINGS, payday: weekday(addDays(today, -4)), spendDays: [weekday(today), weekday(addDays(today, 1))], spendAmount: 2000 }, start);
  for (const [ago, items] of DEMO_DAYS) {
    const d = addDays(today, -ago);
    newDay(s, d);
    for (const [amount, cat, name, asked] of items) {
      if (asked) worry(s, d, { name, amount, cat }, 'buy');
      else record(s, d, amount, cat, name);
    }
    for (const [kAgo, name, amount, cat] of DEMO_KEPT) if (kAgo === ago) worry(s, d, { name, amount, cat }, 'skip');
    if (ago === 4) saveMoney(s, d, 1200);
  }
  newDay(s, today);
  s.leaves = 42;
  s.chipPrefs = {};
  s.inventory = ['acc-leaf', 'obj-piggy'];
  s.equipped = { acc: 'acc-leaf', obj: 'obj-piggy' };
  s.wrong = [7, 19];
  return s;
}
