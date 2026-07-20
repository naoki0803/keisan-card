// モード定義レジストリ。モード追加はここにエントリを足すだけでよい。
// カード: { a, b, op, answer } — op は表示用('+' / '−')
export const MODES = {
  add10: {
    id: 'add10',
    label: 'たしざん',
    generateCards() {
      const cards = [];
      for (let a = 0; a <= 10; a++) {
        for (let b = 0; b <= 10 - a; b++) {
          if (a === 0 && b === 0) continue;
          cards.push({ a, b, op: '+', answer: a + b });
        }
      }
      return cards;
    },
  },
  sub10: {
    id: 'sub10',
    label: 'ひきざん',
    generateCards() {
      const cards = [];
      for (let a = 0; a <= 10; a++) {
        for (let b = 0; b <= a; b++) {
          if (a === 0 && b === 0) continue;
          cards.push({ a, b, op: '−', answer: a - b });
        }
      }
      return cards;
    },
  },
};

// Fisher–Yates。元配列は変更せず新しい配列を返す
export function shuffle(cards) {
  const arr = cards.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
