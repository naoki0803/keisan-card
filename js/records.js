// モード別の記録(ベストタイム・履歴)。storage は差し替え可能(テスト用)。
const KEY = 'keisan-card:records';
const HISTORY_MAX = 10;

function defaultStorage() {
  return globalThis.localStorage;
}

function load(storage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function getBest(modeId, storage = defaultStorage()) {
  return load(storage)[modeId]?.best ?? null;
}

export function getHistory(modeId, storage = defaultStorage()) {
  return load(storage)[modeId]?.history ?? [];
}

// 結果を保存し、ベスト更新かどうかを返す
export function saveResult(modeId, { timeMs, mistakes, date }, storage = defaultStorage()) {
  const records = load(storage);
  const entry = records[modeId] ?? { best: null, history: [] };
  const isNewBest = entry.best === null || timeMs < entry.best;
  if (isNewBest) entry.best = timeMs;
  entry.history = [{ timeMs, mistakes, date }, ...entry.history].slice(0, HISTORY_MAX);
  records[modeId] = entry;
  storage.setItem(KEY, JSON.stringify(records));
  return { isNewBest, best: entry.best, history: entry.history };
}
