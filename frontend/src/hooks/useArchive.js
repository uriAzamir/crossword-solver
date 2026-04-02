import { useState, useEffect, useCallback } from 'react';
import { fetchPuzzleList, triggerSync } from '../utils/apiClient';

const CACHE_KEY = 'crossword_archive_meta';
const CACHE_VERSION = 2;

function loadCached() {
  try {
    const item = localStorage.getItem(CACHE_KEY);
    if (!item) return [];
    const parsed = JSON.parse(item);
    if (parsed?.version !== CACHE_VERSION) return [];
    return parsed.puzzles || [];
  } catch {
    return [];
  }
}

function saveCache(puzzles) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      puzzles,
    }));
  } catch {}
}

export function useArchive() {
  const [puzzles, setPuzzles] = useState(loadCached);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(() => loadCached().length > 0);
  const [fetchError, setFetchError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchPuzzleList();
      setPuzzles(list);
      saveCache(list);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || 'שגיאת חיבור');
    }
  }, []);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    setFetchError(null);
    try {
      await triggerSync();
      await refresh();
    } finally {
      setIsSyncing(false);
      setInitialSyncDone(true);
    }
  }, [refresh]);

  // On mount: show cache immediately, sync in background
  useEffect(() => {
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { puzzles, isSyncing, initialSyncDone, fetchError, refresh, sync };
}
