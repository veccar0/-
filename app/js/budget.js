// 돈 계산과 보상 규칙. 화면과 저장소를 모르는 순수 함수만 둔다.
// 날짜는 기기 로컬 달력 날짜 문자열 'YYYY-MM-DD'로 다룬다.

const pad = (n) => String(n).padStart(2, '0');
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const DAY = 86400000;

export const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDays = (s, n) => fromUtc(parse(s) + n * DAY);
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
export const weekday = (s) => new Date(parse(s)).getUTCDay();

function monthDay(y, m, d) {
  // m은 0부터. 범위를 넘으면 연도를 넘긴다.
  return fromUtc(Date.UTC(y, m, d));
}

export function cycleRange(settings, today) {
  let start, end;
  if (settings.cycle === 'monthly') {
    const [y, m, d] = today.split('-').map(Number);
    const pay = Math.min(28, Math.max(1, settings.payday));
    start = d >= pay ? monthDay(y, m - 1, pay) : monthDay(y, m - 2, pay);
    const [sy, sm] = start.split('-').map(Number);
    end = addDays(monthDay(sy, sm, pay), -1);
  } else {
    const back = (weekday(today) - settings.payday + 7) % 7;
    start = addDays(today, -back);
    end = addDays(start, 6);
  }
  return { start, end, days: diffDays(start, end) + 1 };
}

export const spendable = (s) => s.allowance - s.fixed - s.savePerCycle;

const sumOn = (entries, pred) => entries.reduce((t, e) => (pred(e) ? t + e.amount : t), 0);

export function dayStatus(state, today) {
  const s = state.settings;
  const cycle = cycleRange(s, today);
  const money = spendable(s);
  const inCycleBefore = (e) => e.date >= cycle.start && e.date < today;
  const usedBefore = sumOn(state.entries, (e) => inCycleBefore(e) && (e.type === 'spend' || e.type === 'save'));
  const daysLeft = diffDays(today, cycle.end) + 1;
  const limit = Math.max(0, Math.floor((money - usedBefore) / daysLeft));
  const spentToday = sumOn(state.entries, (e) => e.date === today && e.type === 'spend');
  const savedToday = sumOn(state.entries, (e) => e.date === today && e.type === 'save');
  const baseLimit = Math.floor(money / cycle.days);
  return {
    limit, spentToday, savedToday,
    left: limit - spentToday - savedToday,
    baseLimit, bonus: limit - baseLimit,
    cycle, spendable: money, daysLeft,
    cycleLeft: money - usedBefore - spentToday - savedToday,
  };
}

export function goalProgress(state) {
  const extra = sumOn(state.entries, (e) => e.type === 'save');
  const saved = state.autoSaved + extra;
  const amount = state.settings.goalAmount;
  return { saved, amount, ratio: amount > 0 ? Math.min(1, saved / amount) : 0, remaining: Math.max(0, amount - saved) };
}

export function streak(state, today) {
  let n = 0;
  for (let d = addDays(today, -1); d >= state.startDate; d = addDays(d, -1)) {
    const st = dayStatus(state, d);
    if (st.spentToday > st.limit) break;
    n += 1;
  }
  return n;
}

export const level = (days) => Math.min(8, 1 + Math.floor(days / 3));

export const REWARD = { quiz: 3, retry: 1, record: 1, save: 2, nospend: 5 };
const DAILY_CAP = { record: 5, save: 2 };

export function rewardFor(state, action, today, amount = 0) {
  if (action === 'record' && amount < 100) return 0;
  const cap = DAILY_CAP[action];
  if (cap !== undefined) {
    const got = sumOn(state.rewardLog, (r) => r.date === today && r.action === action);
    if (got + REWARD[action] > cap) return 0;
  }
  return REWARD[action];
}

export function quizIndexes(today, total = 30, perDay = 5) {
  const day = diffDays('1970-01-01', today);
  const start = (day * perDay) % total;
  return Array.from({ length: perDay }, (_, i) => (start + i) % total);
}
