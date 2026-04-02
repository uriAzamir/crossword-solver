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
