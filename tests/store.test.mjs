import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, load, save, setupBudget, newDay, record, saveMoney, worry, pendingHolds, resolveHold, demoState, todayOf, memoryStorage } from '../app/js/store.js';
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

test('days pass without any automatic leaves', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-04');
  newDay(s, '2026-11-06');
  assert.equal(s.leaves, 0);
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

test('record and saveMoney add entries without leaves', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  record(s, '2026-11-02', 3000, 'friends');
  saveMoney(s, '2026-11-02', 1000);
  assert.equal(s.leaves, 0);
  assert.equal(dayStatus(s, '2026-11-02').left, 714 - 3000 - 1000);
  assert.equal(goalProgress(s).saved, 16000);
});

test('overspending a cycle is taken out of the jar when the next cycle starts', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  record(s, '2026-11-02', 9000, 'friends');
  const ev = newDay(s, '2026-11-09');
  assert.equal(s.autoSaved, 15000 + 15000 - 4000);
  assert.ok(ev.some((e) => e.type === 'overdraw' && e.amount === 4000));
});

test('buy records a spend, skip gives leaves for the money kept this cycle', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  const b = worry(s, '2026-11-02', { name: '떡볶이', amount: 4000, cat: 'friends' }, 'buy');
  assert.equal(b.outcome, 'buy');
  assert.equal(s.entries.find((e) => e.id === b.entryId).amount, 4000);
  const k = worry(s, '2026-11-02', { name: '마라탕', amount: 9000, cat: 'friends' }, 'skip');
  assert.equal(k.leaves, 1); // 이번 주 남은 돈 1,000원까지만 인정
  assert.equal(k.kept, 1000);
  assert.equal(s.leaves, 1);
  assert.equal(s.entries.length, 1);
  assert.deepEqual(s.chipPrefs['마라탕'], { amount: 9000, count: 1 });
});

test('the same item earns leaves at most twice a day', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  const item = { name: '편의점 음료', amount: 2000, cat: 'cafe' };
  assert.equal(worry(s, '2026-11-02', item, 'skip').leaves, 2);
  assert.equal(worry(s, '2026-11-02', item, 'skip').leaves, 2);
  assert.equal(worry(s, '2026-11-02', item, 'skip').leaves, 0);
});

test('a hold comes back the next day and can be resolved either way', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  const h = worry(s, '2026-11-02', { name: '마라탕', amount: 9000, cat: 'friends' }, 'hold');
  assert.equal(s.leaves, 0);
  assert.equal(pendingHolds(s, '2026-11-02').length, 0);
  newDay(s, '2026-11-03');
  assert.equal(pendingHolds(s, '2026-11-03').length, 1);
  resolveHold(s, '2026-11-03', h.id, 'skip');
  assert.equal(h.outcome, 'skip');
  assert.equal(h.leaves, 5);
  assert.equal(pendingHolds(s, '2026-11-03').length, 0);
  const h2 = worry(s, '2026-11-03', { name: '다이소', amount: 5000, cat: 'shopping' }, 'hold');
  resolveHold(s, '2026-11-04', h2.id, 'buy');
  assert.ok(s.entries.some((e) => e.id === h2.entryId && e.date === '2026-11-04'));
});

test('a hold left unanswered for 3 days counts as not bought', () => {
  const s = setupBudget(blankState(), weekly, '2026-11-02');
  const h = worry(s, '2026-11-02', { name: '게임 아이템', amount: 5000, cat: 'etc' }, 'hold');
  newDay(s, '2026-11-04');
  assert.equal(h.outcome, null);
  const ev = newDay(s, '2026-11-05');
  assert.equal(h.outcome, 'skip');
  assert.ok(h.auto);
  assert.ok(ev.some((e) => e.type === 'autokeep' && e.name === '게임 아이템' && e.leaves === h.leaves));
});

test('demo state is ready for the stage: 42 leaves and a 5-day streak', () => {
  const s = demoState('2026-12-11');
  assert.equal(s.leaves, 42);
  assert.equal(streak(s, '2026-12-11'), 5);
  assert.ok(s.entries.length + s.worries.length > 10);
  assert.equal(dayStatus(s, '2026-12-11').cycleLeft, 3200);
  assert.equal(s.settings.goalName, '무선 이어폰');
});

test('demo state looks the same whatever weekday the demo runs on', () => {
  for (const day of ['2026-10-26', '2026-10-29', '2026-11-01', '2026-12-11']) {
    const s = demoState(day);
    assert.equal(streak(s, day), 5, day);
    assert.equal(dayStatus(s, day).limit, dayStatus(demoState('2026-12-11'), '2026-12-11').limit, day);
  }
});
