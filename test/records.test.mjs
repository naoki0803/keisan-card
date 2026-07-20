import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveResult, getBest, getHistory } from '../js/records.js';

// localStorage 互換の簡易モック
function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
}

test('初回の記録はベストになる', () => {
  const s = memoryStorage();
  const r = saveResult('add10', { timeMs: 120000, mistakes: 2, date: '2026-07-20' }, s);
  assert.equal(r.isNewBest, true);
  assert.equal(getBest('add10', s), 120000);
});

test('遅いタイムではベストは更新されない', () => {
  const s = memoryStorage();
  saveResult('add10', { timeMs: 100000, mistakes: 0, date: '2026-07-20' }, s);
  const r = saveResult('add10', { timeMs: 150000, mistakes: 1, date: '2026-07-21' }, s);
  assert.equal(r.isNewBest, false);
  assert.equal(getBest('add10', s), 100000);
});

test('速いタイムでベストが更新される', () => {
  const s = memoryStorage();
  saveResult('add10', { timeMs: 100000, mistakes: 0, date: '2026-07-20' }, s);
  const r = saveResult('add10', { timeMs: 90000, mistakes: 0, date: '2026-07-21' }, s);
  assert.equal(r.isNewBest, true);
  assert.equal(getBest('add10', s), 90000);
});

test('履歴は新しい順で最大10件', () => {
  const s = memoryStorage();
  for (let i = 0; i < 12; i++) {
    saveResult('add10', { timeMs: 100000 + i, mistakes: 0, date: `day${i}` }, s);
  }
  const h = getHistory('add10', s);
  assert.equal(h.length, 10);
  assert.equal(h[0].date, 'day11');
  assert.equal(h[9].date, 'day2');
});

test('モードごとに記録が独立している', () => {
  const s = memoryStorage();
  saveResult('add10', { timeMs: 100000, mistakes: 0, date: 'd' }, s);
  saveResult('sub10', { timeMs: 200000, mistakes: 3, date: 'd' }, s);
  assert.equal(getBest('add10', s), 100000);
  assert.equal(getBest('sub10', s), 200000);
});

test('記録がないモードは best=null / history=[]', () => {
  const s = memoryStorage();
  assert.equal(getBest('sub10', s), null);
  assert.deepEqual(getHistory('sub10', s), []);
});

test('壊れたJSONは空の記録として扱う', () => {
  const s = memoryStorage({ 'keisan-card:records': '{oops' });
  assert.equal(getBest('add10', s), null);
  const r = saveResult('add10', { timeMs: 100, mistakes: 0, date: 'd' }, s);
  assert.equal(r.isNewBest, true);
});
