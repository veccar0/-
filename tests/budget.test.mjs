import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ymd, addDays, diffDays, cycleRange, dayStatus, goalProgress,
  streak, level, quizIndexes,
} from '../app/js/budget.js';

const weekly = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000 };
const base = (entries = [], extra = {}) => ({ settings: weekly, startDate: '2026-11-02', entries, autoSaved: 15000, rewardLog: [], ...extra });
const spend = (date, amount) => ({ id: date + amount, date, type: 'spend', amount, category: 'friends' });
const save = (date, amount) => ({ id: 's' + date + amount, date, type: 'save', amount });

test('ymd formats local calendar date', () => {
  assert.equal(ymd(new Date(2026, 10, 4, 23, 59)), '2026-11-04');
});

test('addDays and diffDays work across month ends', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(diffDays('2026-10-30', '2026-11-02'), 3);
});

test('weekly cycle starts on payday weekday', () => {
  assert.deepEqual(cycleRange(weekly, '2026-11-04'), { start: '2026-11-02', end: '2026-11-08', days: 7 });
  assert.deepEqual(cycleRange(weekly, '2026-11-02'), { start: '2026-11-02', end: '2026-11-08', days: 7 });
  assert.deepEqual(cycleRange(weekly, '2026-11-01'), { start: '2026-10-26', end: '2026-11-01', days: 7 });
});

test('monthly cycle runs from payday to the day before next payday', () => {
  const m = { ...weekly, cycle: 'monthly', payday: 25 };
  assert.deepEqual(cycleRange(m, '2026-11-03'), { start: '2026-10-25', end: '2026-11-24', days: 31 });
  assert.deepEqual(cycleRange(m, '2026-11-25'), { start: '2026-11-25', end: '2026-12-24', days: 30 });
});

test('first day limit splits spendable money over the cycle', () => {
  const s = dayStatus(base(), '2026-11-02');
  assert.equal(s.spendable, 5000);
  assert.equal(s.limit, 714);
  assert.equal(s.left, 714);
  assert.equal(s.daysLeft, 7);
});

test('spending today lowers what is left today, not today\'s limit', () => {
  const s = dayStatus(base([spend('2026-11-02', 3000)]), '2026-11-02');
  assert.equal(s.limit, 714);
  assert.equal(s.spentToday, 3000);
  assert.equal(s.left, -2286);
});

test('overspending is spread over the remaining days (rolling)', () => {
  const s = dayStatus(base([spend('2026-11-02', 3000)]), '2026-11-03');
  assert.equal(s.limit, 333);
  assert.equal(s.bonus, 333 - 714);
});

test('saving money under budget raises tomorrow by the leftover', () => {
  const s = dayStatus(base([spend('2026-11-02', 200)]), '2026-11-03');
  assert.equal(s.limit, Math.floor(4800 / 6));
  assert.ok(s.bonus > 0);
});

test('extra saving lowers the following days limit', () => {
  const s = dayStatus(base([save('2026-11-02', 2000)]), '2026-11-03');
  assert.equal(s.limit, 500);
});

test('limit never goes below zero', () => {
  const s = dayStatus(base([spend('2026-11-02', 9000)]), '2026-11-03');
  assert.equal(s.limit, 0);
});

test('entries from a previous cycle do not count', () => {
  const s = dayStatus(base([spend('2026-11-01', 4000)]), '2026-11-02');
  assert.equal(s.limit, 714);
});

test('goal progress counts auto savings plus extra savings', () => {
  const g = goalProgress(base([save('2026-11-02', 2000), save('2026-11-03', 1000)]));
  assert.deepEqual(g, { saved: 18000, amount: 200000, ratio: 0.09, remaining: 182000 });
});

test('streak counts consecutive past days within the limit', () => {
  const entries = [spend('2026-11-02', 500), spend('2026-11-03', 9000), spend('2026-11-04', 0)];
  assert.equal(streak(base(entries), '2026-11-06'), 2);
  assert.equal(streak(base([]), '2026-11-06'), 4);
  assert.equal(streak(base([]), '2026-11-02'), 0);
});

test('level rises every three streak days up to 8', () => {
  assert.equal(level(0), 1);
  assert.equal(level(5), 2);
  assert.equal(level(6), 3);
  assert.equal(level(99), 8);
});

test('daily quiz rotation shows 5 questions and covers all 30 in 6 days', () => {
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const idx = quizIndexes(addDays('2026-11-02', i));
    assert.equal(idx.length, 5);
    idx.forEach((n) => seen.add(n));
  }
  assert.equal(seen.size, 30);
});
