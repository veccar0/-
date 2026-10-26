import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ, AREAS } from '../app/js/quiz-data.js';
import { SHOP } from '../app/js/shop-data.js';

test('quiz bank has 30 well-formed questions', () => {
  assert.equal(QUIZ.length, 30);
  QUIZ.forEach((q, i) => {
    assert.equal(q.id, i, `id ${i}`);
    assert.equal(q.choices.length, 3, `choices ${i}`);
    assert.ok([0, 1, 2].includes(q.answer), `answer ${i}`);
    assert.ok(q.explain.length > 10, `explain ${i}`);
    assert.ok(AREAS.includes(q.area), `area ${i}`);
  });
});

test('quiz covers all 7 areas', () => {
  assert.equal(AREAS.length, 7);
  AREAS.forEach((a) => assert.ok(QUIZ.some((q) => q.area === a), a));
});

test('quiz answers are not all in the same position', () => {
  const counts = [0, 1, 2].map((n) => QUIZ.filter((q) => q.answer === n).length);
  counts.forEach((c) => assert.ok(c >= 7, `answer spread ${counts}`));
});

test('shop has 4 accessories and 4 hanbok with prices and images', () => {
  assert.equal(SHOP.filter((i) => i.kind === 'acc').length, 4);
  assert.equal(SHOP.filter((i) => i.kind === 'hanbok').length, 4);
  SHOP.forEach((i) => {
    assert.ok(i.price > 0);
    assert.match(i.img, /^assets\/char\/.+\.png$/);
  });
});
