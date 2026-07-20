import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeSpeechEvent, FRESH_CONSUMED } from '../js/speech.js';

// バグ再現: 「4」で正解 → 同じ認識結果が「48」に成長 → 次の問題(答え8)
test('同一発話の続きから次の答えを判定できる(4→48問題)', () => {
  // 1問目(答え4): interim「4」で正解
  const r1 = judgeSpeechEvent({ text: '4', isFinal: false, index: 0 }, FRESH_CONSUMED, 4);
  assert.equal(r1.verdict, 'correct');
  // 2問目(答え8): 同じ result が「48」に成長 → 未消費の「8」だけで判定
  const r2 = judgeSpeechEvent({ text: '48', isFinal: false, index: 0 }, r1.consumed, 8);
  assert.equal(r2.verdict, 'correct');
  assert.equal(r2.value, 8);
});

test('interim正解のあとに届く同内容のfinalは無視される', () => {
  const r1 = judgeSpeechEvent({ text: '4', isFinal: false, index: 0 }, FRESH_CONSUMED, 4);
  const r2 = judgeSpeechEvent({ text: '4', isFinal: true, index: 0 }, r1.consumed, 8);
  assert.equal(r2.verdict, null);
});

test('finalで届いた連結発話も未消費部分で正しく判定される', () => {
  const r1 = judgeSpeechEvent({ text: '4', isFinal: false, index: 0 }, FRESH_CONSUMED, 4);
  const r2 = judgeSpeechEvent({ text: '48', isFinal: true, index: 0 }, r1.consumed, 8);
  assert.equal(r2.verdict, 'correct');
});

test('かな発話の連結も未消費部分で判定される', () => {
  const r1 = judgeSpeechEvent({ text: 'よん', isFinal: false, index: 0 }, FRESH_CONSUMED, 4);
  const r2 = judgeSpeechEvent({ text: 'よんはち', isFinal: false, index: 0 }, r1.consumed, 8);
  assert.equal(r2.verdict, 'correct');
  assert.equal(r2.value, 8);
});

test('新しい発話(index が進む)は全文で判定される', () => {
  const r1 = judgeSpeechEvent({ text: '4', isFinal: false, index: 0 }, FRESH_CONSUMED, 4);
  const r2 = judgeSpeechEvent({ text: '8', isFinal: false, index: 1 }, r1.consumed, 8);
  assert.equal(r2.verdict, 'correct');
});

test('interimの不正解は判定しない(finalを待つ)', () => {
  const r = judgeSpeechEvent({ text: '5', isFinal: false, index: 0 }, FRESH_CONSUMED, 8);
  assert.equal(r.verdict, null);
});

test('finalの不正解は wrong と判定される', () => {
  const r = judgeSpeechEvent({ text: '5', isFinal: true, index: 0 }, FRESH_CONSUMED, 8);
  assert.equal(r.verdict, 'wrong');
  assert.equal(r.value, 5);
});

test('数値が読み取れないfinalは無視される', () => {
  const r = judgeSpeechEvent({ text: 'わからない', isFinal: true, index: 0 }, FRESH_CONSUMED, 8);
  assert.equal(r.verdict, null);
});

test('言い直し(5→違う、8)は最後の数値で正解になる', () => {
  const r = judgeSpeechEvent({ text: '5 えっと 8', isFinal: false, index: 0 }, FRESH_CONSUMED, 8);
  assert.equal(r.verdict, 'correct');
});

test('不正解final後、同じカードへの再挑戦は新しい発話で正解できる', () => {
  const r1 = judgeSpeechEvent({ text: '5', isFinal: true, index: 0 }, FRESH_CONSUMED, 8);
  assert.equal(r1.verdict, 'wrong');
  const r2 = judgeSpeechEvent({ text: '8', isFinal: false, index: 1 }, r1.consumed, 8);
  assert.equal(r2.verdict, 'correct');
});

test('3問連続を一息で答えられる(4→48→483)', () => {
  const r1 = judgeSpeechEvent({ text: '4', isFinal: false, index: 0 }, FRESH_CONSUMED, 4);
  const r2 = judgeSpeechEvent({ text: '48', isFinal: false, index: 0 }, r1.consumed, 8);
  const r3 = judgeSpeechEvent({ text: '483', isFinal: false, index: 0 }, r2.consumed, 3);
  assert.equal(r3.verdict, 'correct');
  assert.equal(r3.value, 3);
});
