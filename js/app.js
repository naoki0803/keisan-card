import { MODES, shuffle } from './modes.js';
import { createRecognizer, judgeSpeechEvent, FRESH_CONSUMED } from './speech.js';
import { saveResult, getBest, getHistory } from './records.js';
import { burst, celebrate } from './fx.js';

const $ = (sel) => document.querySelector(sel);

// ---------- 状態 ----------
const state = {
  modeId: null,
  cards: [],
  index: 0,
  mistakes: 0,
  startTime: 0,
  accepting: false, // 回答受付中か(カウントダウン中・結果画面では false)
  timerId: null,
  // 音声: 同一発話内で消費済みのテキスト範囲(speech.js の judgeSpeechEvent 参照)
  consumed: FRESH_CONSUMED,
};

let recognizer = null;
let heardClearId = null;
let judgeClearId = null;

// ---------- 画面切替 ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(`#screen-${name}`).classList.add('active');
}

// ---------- 表示ユーティリティ ----------
function formatTime(ms) {
  if (ms === null || ms === undefined) return '--:--';
  const total = Math.floor(ms / 100); // 0.1秒単位
  const m = Math.floor(total / 600);
  const s = Math.floor((total % 600) / 10);
  const t = total % 10;
  return `${m}:${String(s).padStart(2, '0')}.${t}`;
}

function updateHomeBests() {
  for (const mode of Object.values(MODES)) {
    const el = document.querySelector(`[data-best="${mode.id}"]`);
    const best = getBest(mode.id);
    el.textContent = best === null ? 'さいそく --:--' : `さいそく ${formatTime(best)}`;
  }
}

// ---------- タイマー ----------
function startTimer() {
  state.startTime = performance.now();
  state.timerId = setInterval(() => {
    $('#play-timer').textContent = formatTime(performance.now() - state.startTime);
  }, 100);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

// ---------- 判定表示(○ / ×) ----------
function flashJudge(kind) {
  const judge = $('#judge');
  clearTimeout(judgeClearId);
  judge.className = 'judge';
  // 連続表示でもアニメーションが再生されるようリフロー
  void judge.offsetWidth;
  if (kind === 'maru') {
    judge.classList.add('maru');
    judge.textContent = '';
    judgeClearId = setTimeout(() => (judge.className = 'judge'), 550);
  } else {
    judge.classList.add('batsu');
    judge.innerHTML = '<span class="batsu-mark">✕</span><span class="batsu-text">もういちど!</span>';
    judgeClearId = setTimeout(() => (judge.className = 'judge'), 900);
  }
}

// ---------- ゲーム進行 ----------
function renderCard() {
  const card = state.cards[state.index];
  $('#card-text').textContent = `${card.a} ${card.op} ${card.b}`;
  $('#play-progress').textContent = `${state.index + 1} / ${state.cards.length}`;
}

function currentAnswer() {
  return state.cards[state.index].answer;
}

function submitAnswer(value) {
  if (!state.accepting) return;
  if (value === currentAnswer()) {
    state.index++;
    if (state.index >= state.cards.length) {
      finishGame();
      return;
    }
    // 進行が最優先: 先に次のカードを表示してから演出を発火する
    renderCard();
    flashJudge('maru');
    const rect = $('#card').getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else {
    state.mistakes++;
    flashJudge('batsu');
  }
}

function startGame(modeId) {
  state.modeId = modeId;
  state.cards = shuffle(MODES[modeId].generateCards());
  state.index = 0;
  state.mistakes = 0;
  state.accepting = false;
  state.consumed = FRESH_CONSUMED;

  showScreen('play');
  renderCard();
  $('#play-timer').textContent = '0:00.0';
  $('#heard').textContent = '';
  startRecognizer(); // カウントダウン中にマイク許可・起動を済ませる

  // 3・2・1 カウントダウン
  const judge = $('#judge');
  const steps = ['3', '2', '1', 'スタート!'];
  let i = 0;
  const tick = () => {
    if (state.modeId === null) return; // 中断済み
    if (i < steps.length) {
      judge.className = 'judge count';
      void judge.offsetWidth;
      judge.classList.add('pop');
      judge.textContent = steps[i];
      i++;
      setTimeout(tick, i === steps.length ? 500 : 700);
    } else {
      judge.className = 'judge';
      judge.textContent = '';
      state.accepting = true;
      startTimer();
    }
  };
  tick();
}

function finishGame() {
  state.accepting = false;
  const timeMs = performance.now() - state.startTime;
  stopTimer();
  stopRecognizer();

  const result = saveResult(state.modeId, {
    timeMs: Math.round(timeMs),
    mistakes: state.mistakes,
    date: new Date().toLocaleDateString('ja-JP'),
  });

  $('#result-time').textContent = formatTime(timeMs);
  $('#result-mistakes').textContent = `${state.mistakes} かい`;
  $('#result-best').textContent = formatTime(result.best);
  $('#result-newbest').hidden = !result.isNewBest;
  $('#result-title').textContent = result.isNewBest ? '👑 すごい!' : '🎉 できた!';
  showScreen('result');
  if (result.isNewBest) celebrate();
}

function quitGame() {
  state.modeId = null;
  state.accepting = false;
  stopTimer();
  stopRecognizer();
  updateHomeBests();
  showScreen('home');
}

// ---------- 音声認識 ----------
function setMicStatus(status) {
  const el = $('#mic-status');
  if (status === 'listening') el.textContent = '🎤 きいてるよ';
  else if (status === 'denied') el.textContent = '🎤 マイクがつかえないよ。ボタンでこたえてね';
  else el.textContent = '';
}

function showHeard(text) {
  const el = $('#heard');
  el.textContent = text.trim().slice(-8);
  clearTimeout(heardClearId);
  heardClearId = setTimeout(() => (el.textContent = ''), 1500);
}

function handleNumber(event) {
  if (!state.accepting) return;
  const result = judgeSpeechEvent(event, state.consumed, currentAnswer());
  state.consumed = result.consumed;
  // 子どもへのフィードバックは「いま判定対象になった部分」を見せる
  showHeard(result.value !== null ? String(result.value) : result.heard);
  if (result.verdict !== null) submitAnswer(result.value);
}

function startRecognizer() {
  if (!recognizer) {
    recognizer = createRecognizer({
      onNumber: handleNumber,
      onStatus: (status) => {
        if (status === 'listening') {
          // 認識セッションが再起動すると発話 index が 0 に戻る
          state.consumed = FRESH_CONSUMED;
        }
        setMicStatus(status);
      },
    });
  }
  if (!recognizer) {
    setMicStatus('denied'); // ブラウザ非対応
    return;
  }
  recognizer.start();
}

function stopRecognizer() {
  recognizer?.stop();
}

// ---------- 初期化 ----------
function buildNumpad() {
  const pad = $('#numpad');
  for (let n = 0; n <= 10; n++) {
    const btn = document.createElement('button');
    btn.className = 'sticker num-btn num';
    btn.textContent = n;
    btn.addEventListener('click', () => submitAnswer(n));
    pad.appendChild(btn);
  }
}

function renderRecords() {
  const list = $('#records-list');
  list.innerHTML = '';
  for (const mode of Object.values(MODES)) {
    const best = getBest(mode.id);
    const history = getHistory(mode.id);
    const section = document.createElement('div');
    section.className = `sticker records-block records-${mode.id}`;
    const items = history.length
      ? history
          .map(
            (h) =>
              `<li><span class="rec-date">${h.date}</span><span class="rec-time num">${formatTime(h.timeMs)}</span><span class="rec-miss">まちがい ${h.mistakes}</span></li>`
          )
          .join('')
      : '<li class="rec-empty">まだ きろくが ないよ</li>';
    section.innerHTML = `
      <h3>${mode.label}</h3>
      <p class="records-best">👑 さいそく <span class="num">${formatTime(best)}</span></p>
      <ul class="records-history">${items}</ul>`;
    list.appendChild(section);
  }
}

function init() {
  buildNumpad();
  updateHomeBests();

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => startGame(btn.dataset.mode));
  });
  $('#btn-quit').addEventListener('click', quitGame);
  $('#btn-retry').addEventListener('click', () => startGame(state.modeId));
  $('#btn-home').addEventListener('click', () => {
    updateHomeBests();
    showScreen('home');
  });
  $('#btn-records').addEventListener('click', () => {
    renderRecords();
    showScreen('records');
  });
  $('#btn-records-back').addEventListener('click', () => {
    updateHomeBests();
    showScreen('home');
  });
}

init();
