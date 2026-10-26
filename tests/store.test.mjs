import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, load, save, setupBudget, newDay, record, saveMoney, demoState, todayOf, memoryStorage } from '../app/js/store.js';
import { dayStatus, streak, goalProgress } from '../app/js/budget.js';

const weekly = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000 };

test('load returns a blank state when storage is empty or broken', () => {
  assert.deepEqual(load(memoryStorage()), blankState());
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(load(broken), blankState());
  assert.doesNotThrow(() => save(blankState(), broken));
});

test('save then load round-trips the state', () => {
  const st = memoryStorage();
  const s = setupBudget(blankState(), weekly, '2026-11-04');
  save(s, st);
  assert.deepEqual(load(st), s);
});

test('setup moves the cycle saving into the jar once', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-04');
  assert.equal(s.autoSaved, 15000);
  newDay(s, '2026-11-04');
  assert.equal(s.autoSaved, 15000);
});

test('todayOf applies the demo day offset', () => {
  const s = { ...blankState(), devOffset: 2 };
  assert.equal(todayOf(s, new Date(2026, 10, 4, 9)), '2026-11-06');
});

test('a day without spending earns 5 leaves once, the next day', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-04');
  const ev = newDay(s, '2026-11-05');
  assert.equal(s.leaves, 5);
  assert.ok(ev.some((e) => e.type === 'nospend' && e.date === '2026-11-04'));
  newDay(s, '2026-11-05');
  assert.equal(s.leaves, 5);
});

test('a day with spending earns no no-spend reward', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-04');
  record(s, '2026-11-04', 3000, 'friends');
  const before = s.leaves;
  newDay(s, '2026-11-05');
  assert.equal(s.leaves, before);
});

test('a new cycle saves again and moves last cycle leftover to the jar', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  record(s, '2026-11-02', 3000, 'friends');
  const ev = newDay(s, '2026-11-09');
  assert.equal(s.autoSaved, 15000 + 15000 + 2000);
  assert.ok(ev.some((e) => e.type === 'leftover' && e.amount === 2000));
  newDay(s, '2026-11-10');
  assert.equal(s.autoSaved, 32000);
});

test('record and saveMoney add entries and leaves', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  assert.equal(record(s, '2026-11-02', 3000, 'friends'), 1);
  assert.equal(saveMoney(s, '2026-11-02', 1000), 2);
  assert.equal(saveMoney(s, '2026-11-02', 1000), 0);
  assert.equal(s.leaves, 3);
  assert.equal(dayStatus(s, '2026-11-02').left, 714 - 3000 - 2000);
  assert.equal(goalProgress(s).saved, 17000);
});

test('demo state is ready for the stage: 42 leaves and a 5-day streak', () => {
  const s = demoState('2026-12-11');
  assert.equal(s.leaves, 42);
  assert.equal(streak(s, '2026-12-11'), 5);
  assert.ok(s.entries.length > 10);
  assert.equal(s.settings.goalName, '무선 이어폰');
});
