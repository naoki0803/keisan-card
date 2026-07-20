import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenNumber } from '../js/speech.js';

const cases = [
  // アラビア数字
  ['5', 5],
  ['10', 10],
  ['0', 0],
  ['81', 81],
  ['100', 100],
  // かな(単音)
  ['ぜろ', 0],
  ['れい', 0],
  ['いち', 1],
  ['に', 2],
  ['さん', 3],
  ['よん', 4],
  ['し', 4],
  ['ご', 5],
  ['ろく', 6],
  ['なな', 7],
  ['しち', 7],
  ['はち', 8],
  ['きゅう', 9],
  ['く', 9],
  ['じゅう', 10],
  // カタカナ・長音(子どもの発話ゆれ)
  ['ゼロ', 0],
  ['ゴー', 5],
  ['じゅー', 10],
  ['ろくー', 6],
  // かな(複合・最長一致)
  ['じゅういち', 11],
  ['じゅうに', 12],
  ['にじゅう', 20],
  ['にじゅうご', 25],
  ['はちじゅういち', 81],
  ['ひゃく', 100],
  // 漢数字
  ['零', 0],
  ['一', 1],
  ['五', 5],
  ['十', 10],
  ['十一', 11],
  ['二十五', 25],
  ['百', 100],
  // 誤認識されやすい同音異義語
  ['位置', 1],
  ['蜂', 8],
  // 末尾トークンの評価(言い直し・前置き)
  ['えーと ご', 5],
  ['えーとご', 5],
  ['さん じゅう', 10],
  ['5 6', 6],
  ['3+4は7', 7],
  // 数値なし
  ['わからない', null],
  ['', null],
  ['   ', null],
];

for (const [input, expected] of cases) {
  test(`parseSpokenNumber(${JSON.stringify(input)}) → ${expected}`, () => {
    assert.equal(parseSpokenNumber(input), expected);
  });
}

test('範囲外(100超)は数値として返さない', () => {
  assert.equal(parseSpokenNumber('101'), null);
  assert.equal(parseSpokenNumber('250'), null);
});
