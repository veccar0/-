import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askLine } from '../app/js/coach.js';
import { judge, ruleLine } from '../app/js/decide.js';

const settings = { cycle: 'weekly', payday: 1, allowance: 30000, fixed: 10000, savePerCycle: 15000, goalName: '무선 이어폰', goalAmount: 200000 };
const state = { settings, startDate: '2026-11-02', entries: [], autoSaved: 15000, worries: [], chipPrefs: {} };

test('without a key the line comes from the rules', async () => {
  const card = judge(state, '2026-11-04', { name: '떡볶이', amount: 4000, cat: 'friends' });
  const a = await askLine({ apiKey: '', card });
  assert.equal(a.source, 'rule');
  assert.equal(a.text, ruleLine(card));
});
