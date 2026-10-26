import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWeek, readQuestion, ruleAnswer } from '../app/js/coach.js';
import { dayStatus } from '../app/js/budget.js';

const settings = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000 };
const state = (entries = []) => ({ settings, startDate: '2026-11-02', entries, autoSaved: 15000, rewardLog: [] });
const wed = '2026-11-04';
const spentMon = [{ id: 'a', date: '2026-11-02', type: 'spend', amount: 400, category: 'friends' }];

test('readQuestion finds a weekday and an amount', () => {
  assert.deepEqual(readQuestion('금요일에 떡볶이 4,000원 먹어도 돼?'), { weekday: 5, amount: 4000, topic: 'reserve' });
  assert.deepEqual(readQuestion('금요일에 떡볶이 먹어도 돼?'), { weekday: 5, amount: 4000, topic: 'reserve' });
  assert.equal(readQuestion('이번 주 지출 계획 짜 줘').topic, 'plan');
  assert.equal(readQuestion('이어폰 더 빨리 사려면?').topic, 'goal');
});

test('plan never spends more than what is left in the cycle', () => {
  const s = dayStatus(state(spentMon), wed);
  const plan = planWeek(s, wed);
  assert.equal(plan.length, 5);
  assert.equal(plan[0].date, wed);
  assert.ok(plan.reduce((t, d) => t + d.amount, 0) <= s.cycleLeft);
});

test('reserving money for one day lowers the other days', () => {
  const s = dayStatus(state(spentMon), wed);
  const plan = planWeek(s, wed, { date: '2026-11-06', amount: 3000 });
  const fri = plan.find((d) => d.date === '2026-11-06');
  assert.equal(fri.amount, 3000);
  assert.ok(plan.reduce((t, d) => t + d.amount, 0) <= s.cycleLeft);
});

test('rule answer says yes with the numbers when it fits', () => {
  const s = dayStatus(state(spentMon), wed);
  const a = ruleAnswer('금요일에 떡볶이 3000원 먹어도 돼?', s, wed, state(spentMon));
  assert.match(a.text, /금요일/);
  assert.match(a.text, /3,000원/);
  assert.match(a.text, /돼/);
});

test('rule answer offers the most it can when it does not fit', () => {
  const s = dayStatus(state(spentMon), wed);
  const a = ruleAnswer('금요일에 20000원 써도 돼?', s, wed, state(spentMon));
  assert.match(a.text, new RegExp(s.cycleLeft.toLocaleString('ko-KR')));
  assert.doesNotMatch(a.text, /쓰지 마/);
});
