import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../app/js/budget.js';
import { CHIPS, chipList, judge, ruleLine, treeOf, goalDays, weekStats, iGa, ro, tightPlan, goalOptions, saveForDate } from '../app/js/decide.js';

const settings = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000 };
const spend = (date, amount) => ({ id: date + amount, date, type: 'spend', amount, category: 'snack' });
// 기획서 v3의 금요일: 이번 주 남은 돈 3,200원, 저축 48,300원
const friday = '2026-11-06';
const doyeon = (extra = {}) => ({
  settings, startDate: '2026-11-02', autoSaved: 48300, worries: [], chipPrefs: {},
  entries: [spend('2026-11-02', 300), spend('2026-11-03', 1000), spend('2026-11-04', 500)],
  ...extra,
});
const maratang = { name: '마라탕', amount: 9000, cat: 'friends' };

test('the maratang card matches the plan: 3 days later if bought, 1 day sooner and 3 leaves if kept', () => {
  const c = judge(doyeon(), friday, maratang);
  assert.equal(c.left, 3200);
  assert.equal(c.over, 5800);
  assert.equal(c.weekAfterBuy, 0);
  assert.equal(c.tomorrowNow, 1600);
  assert.equal(c.tomorrowBuy, 0);
  assert.equal(c.goalNow, 71);
  assert.equal(c.later, 3);
  assert.equal(c.sooner, 1);
  assert.equal(c.leaves, 3);
  assert.equal(c.nextCycle, false);
});

test('the rule line allows first, never forbids, and offers one alternative', () => {
  const line = ruleLine(judge(doyeon(), friday, maratang));
  assert.match(line, /^먹어도 돼!/);
  assert.match(line, /5,800원 많아서 무선 이어폰이 3일 늦어져/);
  assert.match(line, /떡볶이로 바꾸면 800원만 넘어/);
  assert.doesNotMatch(line, /하지 마|안 돼/);
  const cheap = ruleLine(judge(doyeon(), friday, { name: '게임 아이템', amount: 2000, cat: 'etc' }));
  assert.match(cheap, /^사도 돼! 사고 나면 이번 주 1,200원 남아/);
});

test('the line remembers when the same thing comes up again this week', () => {
  const worries = [1, 2].map((i) => ({ id: `w${i}`, date: '2026-11-0' + (2 + i), name: '편의점 음료', amount: 2000, outcome: 'skip', resolvedOn: '2026-11-0' + (2 + i), leaves: 2 }));
  const line = ruleLine(judge(doyeon({ worries }), friday, { name: '편의점 음료', amount: 2000, cat: 'cafe' }));
  assert.match(line, /편의점 음료만 3번째 고민이야/);
});

test('on the last day of the cycle, tomorrow means next cycle and is not changed by buying', () => {
  const c = judge(doyeon(), '2026-11-08', maratang);
  assert.equal(c.nextCycle, true);
  assert.equal(c.tomorrowBuy, c.tomorrowNow);
});

test('goal days follow the saving speed and are unknown without saving', () => {
  assert.equal(goalDays(151700, settings, 7), 71);
  assert.equal(goalDays(0, settings, 7), 0);
  assert.equal(goalDays(1000, { ...settings, savePerCycle: 0 }, 7), null);
});

test('kept money grows the tree only as far as it is still left this cycle', () => {
  const s = doyeon({ autoSaved: 46000 });
  assert.equal(treeOf(s, friday).stage, 0);
  s.worries.push({ id: 'k', date: friday, name: '마라탕', amount: 9000, outcome: 'skip', resolvedOn: friday, leaves: 3 });
  const t = treeOf(s, friday);
  assert.equal(t.kept, 3200);
  assert.equal(t.saved, 49200);
  assert.equal(t.stage, 0);
  s.autoSaved = 47000;
  assert.equal(treeOf(s, friday).name, '어린 나무');
  s.autoSaved = 200000;
  assert.equal(treeOf(s, friday).name, '열매');
});

test('chips start in the plan order and move frequent ones forward with remembered prices', () => {
  assert.deepEqual(chipList().map((c) => c.name), CHIPS.map((c) => c.name));
  const list = chipList({ 마라탕: { amount: 8500, count: 3 } });
  assert.equal(list[0].name, '마라탕');
  assert.equal(list[0].amount, 8500);
});

test('week stats count worries, kept ones and the most asked item', () => {
  const w = (id, name, outcome) => ({ id, date: '2026-11-04', name, amount: 2000, outcome, resolvedOn: outcome ? '2026-11-04' : null });
  const st = weekStats(doyeon({ worries: [w('a', '음료', 'skip'), w('b', '음료', 'buy'), w('c', '마라탕', null), w('d', '음료', 'skip')] }), friday);
  assert.equal(st.count, 4);
  assert.equal(st.kept, 2);
  assert.equal(Math.round(st.ratio * 100), 67);
  assert.equal(st.keptMoney, 4000);
  assert.deepEqual(st.top, { name: '음료', n: 3 });
});

test('Korean particles follow the last syllable', () => {
  assert.equal(iGa('무선 이어폰'), '무선 이어폰이');
  assert.equal(iGa('자전거'), '자전거가');
  assert.equal(ro('떡볶이'), '떡볶이로');
  assert.equal(ro('마라탕'), '마라탕으로');
  assert.equal(ro('편의점 음료'), '편의점 음료로');
  assert.equal(ro('젤'), '젤로');
});

test('the card says when something costs more than all the money there is', () => {
  const c = judge(doyeon(), friday, { name: '게임기', amount: 300000, cat: 'etc' });
  assert.equal(c.canBuy, false);
  assert.equal(c.short, 300000 - (3200 + 48300));
  assert.match(ruleLine(c), /아직은 못 사/);
});

test('money already counted as kept this cycle is not kept again', () => {
  const worries = [{ id: 'k', date: '2026-11-05', name: '마라탕', amount: 9000, outcome: 'skip', resolvedOn: '2026-11-05', kept: 3200, leaves: 3 }];
  const c = judge(doyeon({ worries }), friday, { name: '떡볶이', amount: 4000, cat: 'friends' });
  assert.equal(c.keep, 0);
  assert.equal(c.leaves, 0);
  assert.equal(c.leafReason, 'empty');
});

test('a tight plan suggests a smaller saving and shows how much later the goal gets', () => {
  const p = tightPlan(settings, 0);
  assert.equal(p.tight, true);
  assert.equal(p.daily, 714);
  assert.equal(p.fix.savePerCycle, 9500);
  assert.equal(p.fix.daily, 1500);
  assert.equal(p.fix.later, goalDays(200000, { ...settings, savePerCycle: 9500 }, 7) - goalDays(200000, settings, 7));
  assert.equal(tightPlan({ ...settings, savePerCycle: 5000 }).tight, false);
  assert.equal(p.fix.enough, true);
  const poor = tightPlan({ ...settings, allowance: 15000, savePerCycle: 1000 }); // 저축을 0원으로 해도 빠듯함
  assert.equal(poor.fix.savePerCycle, 0);
  assert.equal(poor.fix.enough, false);
  assert.equal(tightPlan({ ...settings, allowance: 15000, savePerCycle: 0 }).fix, null);
});

test('with spend days the tight check uses days × usual amount, and can suggest fewer days', () => {
  const s = { ...settings, spendDays: [2, 5, 6], spendAmount: 2000 }; // 화·금·토 2,000원 → 주 6,000원 필요
  const p = tightPlan(s, 0);
  assert.equal(p.custom, true);
  assert.equal(p.need, 6000);
  assert.equal(p.tight, true);
  assert.equal(p.fix.savePerCycle, 14000);
  assert.equal(p.fewerDays, 2);
  assert.equal(tightPlan({ ...s, spendDays: [5, 6] }).tight, false); // 2일 × 2,000원 = 4,000원 ≤ 5,000원
});

test('goal period is recommended from what can really be saved', () => {
  const s = { ...settings, spendDays: [5, 6], spendAmount: 2000 }; // 30,000 − 10,000 − 4,000 = 16,000원까지 저축 가능
  const { room, options } = goalOptions(s, '2026-11-02');
  assert.equal(room, 16000);
  assert.deepEqual(options.map((o) => o.savePerCycle), [16000, 11200, 8000]);
  assert.equal(options[0].times, 13); // 200,000 ÷ 16,000 = 12.5 → 13번
  // 첫 저축 16,000원은 오늘 들어가고 남은 184,000원은 하루 16,000/7원씩 → 81일 뒤. 은행나무·설정과 같은 계산
  assert.equal(options[0].date, '2027-01-22');
  assert.equal(options[0].date, addDays('2026-11-02', goalDays(184000, { ...s, savePerCycle: 16000 }, 7)));
  const want = saveForDate(s, '2026-11-02', '2026-12-28');
  assert.equal(want.times, 9);
  assert.equal(want.savePerCycle, 22300);
  assert.equal(want.ok, false);
  assert.deepEqual(goalOptions({ ...s, allowance: 14000 }, '2026-11-02').options, []);
});
