import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, shuffle } from '../js/modes.js';

const key = (c) => `${c.a}${c.op}${c.b}`;

test('たしざんモードが登録されている', () => {
  assert.equal(MODES.add10.label, 'たしざん');
  assert.equal(typeof MODES.add10.generateCards, 'function');
});

test('ひきざんモードが登録されている', () => {
  assert.equal(MODES.sub10.label, 'ひきざん');
});

test('たしざん: 0+0のみ除外した65枚', () => {
  const cards = MODES.add10.generateCards();
  assert.equal(cards.length, 65);
  assert.ok(!cards.some((c) => c.a === 0 && c.b === 0));
});

test('たしざん: 答えはすべて0〜10で計算が正しい', () => {
  for (const c of MODES.add10.generateCards()) {
    assert.equal(c.op, '+');
    assert.equal(c.answer, c.a + c.b);
    assert.ok(c.answer >= 0 && c.answer <= 10, key(c));
  }
});

test('たしざん: 0+1、1+0、0+10、10+0 を含む', () => {
  const keys = new Set(MODES.add10.generateCards().map(key));
  for (const k of ['0+1', '1+0', '0+10', '10+0']) assert.ok(keys.has(k), k);
});

test('たしざん: 重複カードがない', () => {
  const cards = MODES.add10.generateCards();
  assert.equal(new Set(cards.map(key)).size, cards.length);
});

test('ひきざん: 0−0のみ除外した65枚', () => {
  const cards = MODES.sub10.generateCards();
  assert.equal(cards.length, 65);
  assert.ok(!cards.some((c) => c.a === 0 && c.b === 0));
});

test('ひきざん: 答えはすべて0〜10で計算が正しい', () => {
  for (const c of MODES.sub10.generateCards()) {
    assert.equal(c.op, '−');
    assert.equal(c.answer, c.a - c.b);
    assert.ok(c.answer >= 0 && c.answer <= 10, key(c));
  }
});

test('ひきざん: n−0 と n−n を含む', () => {
  const keys = new Set(MODES.sub10.generateCards().map(key));
  for (const k of ['5−0', '5−5', '10−0', '10−10', '1−1']) assert.ok(keys.has(k), k);
});

test('shuffle: 同じ要素の並べ替えを返し元配列を壊さない', () => {
  const original = MODES.add10.generateCards();
  const before = original.map(key).join(',');
  const shuffled = shuffle(original);
  assert.equal(original.map(key).join(','), before);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual(new Set(shuffled.map(key)), new Set(original.map(key)));
});
