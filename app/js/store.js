// 앱 상태: 기기 저장, 날짜 넘김 처리, 기록·저축·보상, 시연 데이터.
import { ymd, addDays, weekday, cycleRange, dayStatus, rewardFor } from './budget.js';

const KEY = 'dongguri-v1';

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
  quiz: { date: null, answered: {} },
  wrong: [],
  inventory: [],
  equipped: { acc: null, hanbok: null },
  coachKey: '',
  chat: [],
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
    return { ...blankState(), ...JSON.parse(raw) };
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

export function grant(state, today, action, amount = 0) {
  const n = rewardFor(state, action, today, amount);
  if (n > 0) {
    state.leaves += n;
    state.rewardLog.push({ date: today, action, amount: n });
  }
  return n;
}

function applyCycle(state, today, events) {
  const { start } = cycleRange(state.settings, today);
  if (state.savedCycles.includes(start)) return;
  const prevEnd = addDays(start, -1);
  if (state.savedCycles.length && prevEnd >= state.startDate) {
    const left = dayStatus(state, prevEnd).cycleLeft;
    if (left > 0) {
      state.autoSaved += left;
      events.push({ type: 'leftover', amount: left });
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

// 마지막으로 연 날부터 어제까지를 마감하고 오늘 주기를 준비한다. 여러 번 불러도 같은 결과.
export function newDay(state, today) {
  const events = [];
  if (!state.settings) return events;
  const from = state.lastDay && state.lastDay > state.startDate ? state.lastDay : state.startDate;
  for (let d = from; d < today; d = addDays(d, 1)) {
    applyCycle(state, d, events);
    const spent = state.entries.some((e) => e.date === d && e.type === 'spend');
    const paid = state.rewardLog.some((r) => r.date === d && r.action === 'nospend');
    if (!spent && !paid) {
      state.leaves += 5;
      state.rewardLog.push({ date: d, action: 'nospend', amount: 5 });
      events.push({ type: 'nospend', date: d, leaves: 5 });
    }
  }
  applyCycle(state, today, events);
  state.lastDay = today;
  return events;
}

export function record(state, today, amount, category, memo = '') {
  state.entries.push({ id: newId(), date: today, type: 'spend', amount, category, memo });
  return grant(state, today, 'record', amount);
}

export function saveMoney(state, today, amount) {
  state.entries.push({ id: newId(), date: today, type: 'save', amount });
  return grant(state, today, 'save');
}

export function removeEntry(state, id) {
  state.entries = state.entries.filter((e) => e.id !== id);
}

// 시연용 김도연의 2주. 날짜는 오늘 기준으로 만든다.
const DEMO_SETTINGS = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000, goalDate: null };
const DEMO_DAYS = [
  // 오늘로부터 며칠 전, [금액, 카테고리, 메모]
  [13, [[3000, 'friends', '하굣길 떡볶이']]],
  [12, [[700, 'snack', '젤리']]],
  [11, [[1500, 'cafe', '편의점 음료']]],
  [10, [[4500, 'friends', '노래방']]],
  [9, []],
  [8, [[1200, 'snack', '과자']]],
  [7, [[2000, 'friends', '분식']]],
  [6, [[3800, 'shopping', '볼펜 세트']]],
  [5, []],
  [4, [[300, 'snack', '사탕']]],
  [3, []],
  [2, [[500, 'cafe', '우유']]],
  [1, []],
];

export function demoState(today) {
  const s = blankState();
  const start = addDays(today, -13);
  s.startDate = start;
  // 시연하는 날이 언제든 용돈 주기 5일째가 되도록 받는 요일을 맞춘다.
  setupBudget(s, { ...DEMO_SETTINGS, payday: weekday(addDays(today, -4)) }, start);
  for (const [ago, items] of DEMO_DAYS) {
    const d = addDays(today, -ago);
    newDay(s, d);
    for (const [amount, cat, memo] of items) record(s, d, amount, cat, memo);
    if (ago === 9 || ago === 4) saveMoney(s, d, 1000);
  }
  newDay(s, today);
  s.leaves = 42;
  s.inventory = ['acc-leaf', 'hanbok-walk'];
  s.equipped = { acc: 'acc-leaf', hanbok: null };
  s.wrong = [7, 19];
  return s;
}
