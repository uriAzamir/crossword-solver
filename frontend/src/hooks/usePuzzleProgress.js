import { saveUserProgress, fetchUserProgress } from '../utils/apiClient';

const PROGRESS_VERSION = 2;

function key(puzzleId) {
  return `crossword_progress_${puzzleId}`;
}

export function loadProgress(puzzleId) {
  try {
    const item = localStorage.getItem(key(puzzleId));
    if (!item) return {};
    const parsed = JSON.parse(item);
    if (parsed?.version !== PROGRESS_VERSION) return {};
    return parsed.letters || {};
  } catch {
    return {};
  }
}

export function saveProgress(puzzleId, letters) {
  try {
    localStorage.setItem(key(puzzleId), JSON.stringify({
      version: PROGRESS_VERSION,
      puzzleId,
      letters,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore write errors
  }
}

export function getProgressCount(puzzleId) {
  return Object.keys(loadProgress(puzzleId)).length;
}

// Server-side progress (logged-in users)

export async function loadProgressFromServer(userId, puzzleId) {
  try {
    const all = await fetchUserProgress(userId);
    const entry = all[puzzleId];
    return (entry && entry.letters) ? entry.letters : {};
  } catch {
    return loadProgress(puzzleId); // fallback to localStorage
  }
}

export async function saveProgressToServer(userId, puzzleId, letters) {
  try {
    await saveUserProgress(userId, puzzleId, letters);
    saveProgress(puzzleId, letters); // keep localStorage in sync as cache
  } catch {
    saveProgress(puzzleId, letters); // at minimum save locally
  }
}
