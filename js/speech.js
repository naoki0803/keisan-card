// 音声回答の解釈。数詞パーサは将来のモード拡張(くり上がり・九九・わり算)に備えて 0〜100 対応。

const KANA_DIGIT = {
  いち: 1, に: 2, さん: 3, よん: 4, し: 4, ご: 5,
  ろく: 6, なな: 7, しち: 7, はち: 8, きゅう: 9, く: 9,
};
const KANJI_DIGIT = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const ZERO_WORDS = new Set(['ぜろ', 'れい', '零']);

// 音声認識が数字を同音異義語に変換してしまう典型例
const HOMOPHONES = [
  [/位置/g, 'いち'],
  [/蜂/g, 'はち'],
];

// 長い読みを先に置く(正規表現の選択は先勝ちのため)
const KD = 'いち|さん|よん|しち|ろく|なな|はち|きゅう|に|し|ご|く';
const KJ = '[一二三四五六七八九]';
const TOKEN_RE = new RegExp(
  [
    '\\d+',
    'ひゃく', '百',
    `(?:${KD})?じゅう(?:${KD})?`,
    `(?:${KJ})?十(?:${KJ})?`,
    'ぜろ', 'れい', '零',
    KD,
    KJ,
  ].join('|'),
  'g'
);

function normalize(transcript) {
  let s = transcript.normalize('NFKC');
  for (const [re, to] of HOMOPHONES) s = s.replace(re, to);
  // カタカナ → ひらがな
  s = s.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
  // 長音(「ゴー」「じゅー」など子どもの伸ばした発話)
  s = s.replace(/ゅー/g, 'ゅう').replace(/ー/g, '');
  return s;
}

function tokenValue(token) {
  if (/^\d+$/.test(token)) return Number(token);
  if (token === 'ひゃく' || token === '百') return 100;
  const jyu = token.indexOf('じゅう');
  if (jyu !== -1) {
    const prefix = token.slice(0, jyu);
    const suffix = token.slice(jyu + 3);
    return (prefix ? KANA_DIGIT[prefix] : 1) * 10 + (suffix ? KANA_DIGIT[suffix] : 0);
  }
  const juu = token.indexOf('十');
  if (juu !== -1) {
    const prefix = token.slice(0, juu);
    const suffix = token.slice(juu + 1);
    return (prefix ? KANJI_DIGIT[prefix] : 1) * 10 + (suffix ? KANJI_DIGIT[suffix] : 0);
  }
  if (ZERO_WORDS.has(token)) return 0;
  return KANA_DIGIT[token] ?? KANJI_DIGIT[token] ?? null;
}

// 発話テキストから数値(0〜100)を取り出す。複数あれば最後のもの(言い直し対応)。
// 数値が見つからなければ null。
export function parseSpokenNumber(transcript) {
  const matches = normalize(transcript).match(TOKEN_RE);
  if (!matches || matches.length === 0) return null;
  const value = tokenValue(matches[matches.length - 1]);
  if (value === null || value < 0 || value > 100) return null;
  return value;
}

// 未消費状態の初期値
export const FRESH_CONSUMED = Object.freeze({ index: -1, len: 0 });

// 認識イベントを回答として判定する純粋関数。
// continuous モードでは発話が途切れない限り同じ result にテキストが追記され続ける
// (「4」で正解 → 続けて「はち」と言うと同じ result が「48」に成長する)ため、
// 回答を消費した時点の transcript 長を consumed に記録し、
// 同じ result では未消費のサフィックスだけを判定対象にする。
//
// - event: { text, isFinal, index }
// - consumed: { index, len } 前回消費した result 番号と消費済み文字数
// - answer: 現在のカードの答え
// 返り値: { verdict: 'correct' | 'wrong' | null, value, consumed }
//   verdict が null のときは何もしない(consumed も変化しない)。
export function judgeSpeechEvent(event, consumed, answer) {
  const target =
    event.index === consumed.index ? event.text.slice(consumed.len) : event.text;
  const value = parseSpokenNumber(target);
  if (value === null) return { verdict: null, value: null, heard: target, consumed };

  const consumedNow = { index: event.index, len: event.text.length };
  if (value === answer) {
    // 正解は interim でも即時判定する(体感ゼロラグの要)
    return { verdict: 'correct', value, heard: target, consumed: consumedNow };
  }
  if (event.isFinal) {
    // 不正解は言い終わる前の誤認識かもしれないので final でのみ判定する
    return { verdict: 'wrong', value, heard: target, consumed: consumedNow };
  }
  return { verdict: null, value, heard: target, consumed };
}

// 音声認識ラッパ。認識結果は onNumber({ value, text, isFinal, index }) に流す。
// - interim(isFinal=false): 正解の即時判定に使う(体感ゼロラグの要)
// - final(isFinal=true): 不正解の確定判定に使う
// index は認識セッション内の発話番号。interim で正解済みの発話の final を
// 呼び出し側が無視できるように渡す(onstart でリセットされる)。
// 未対応ブラウザでは null を返す(タップ回答のみで続行)。
export function createRecognizer({ onNumber, onStatus }) {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang = 'ja-JP';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let shouldRun = false;
  let starting = false;

  rec.onstart = () => {
    starting = false;
    onStatus?.('listening');
  };

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      onNumber({ text: result[0].transcript, isFinal: result.isFinal, index: i });
    }
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      shouldRun = false;
      onStatus?.('denied');
    }
    // 'no-speech' 'aborted' 'network' などは onend の自動再起動に任せる
  };

  // モバイルでは認識セッションが勝手に終わるため、動作中は自動で再起動する
  rec.onend = () => {
    if (!shouldRun) return;
    setTimeout(() => {
      if (!shouldRun || starting) return;
      try {
        starting = true;
        rec.start();
      } catch {
        starting = false;
      }
    }, 150);
  };

  return {
    start() {
      if (shouldRun) return;
      shouldRun = true;
      try {
        starting = true;
        rec.start();
      } catch {
        starting = false;
      }
    },
    stop() {
      shouldRun = false;
      try {
        rec.stop();
      } catch {
        /* 既に停止していれば無視 */
      }
      onStatus?.('stopped');
    },
  };
}
