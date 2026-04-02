import React from 'react';
import { useArchive } from '../hooks/useArchive';
import { getProgressCount } from '../hooks/usePuzzleProgress';
import './ArchiveScreen.css';

function formatHebrewDate(isoString) {
  if (!isoString) return '';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(isoString));
  } catch {
    return isoString.slice(0, 10);
  }
}

function PuzzleCard({ puzzle, onTap }) {
  const letterCount = getProgressCount(puzzle.id);

  return (
    <div className="puzzle-card" onClick={() => onTap(puzzle.id)}>
      <div className="puzzle-card-date">{formatHebrewDate(puzzle.published_at)}</div>
      <div className="puzzle-card-title">{puzzle.title}</div>
      <div className="puzzle-card-status">
        {letterCount > 0 ? `${letterCount} אותיות מולאו` : 'לא התחיל'}
      </div>
    </div>
  );
}

function ArchiveScreen({ onOpenPuzzle, onManualUpload }) {
  const { puzzles, isSyncing, initialSyncDone, fetchError, sync } = useArchive();

  return (
    <div className="archive-screen">
      <div className="archive-header">
        <span className="archive-title">דקל בנו</span>
        <button className="archive-refresh-btn" onClick={sync} disabled={isSyncing}>
          {isSyncing ? '...' : 'רענן'}
        </button>
      </div>

      {isSyncing && (
        <div className="archive-syncing">בודק עדכונים...</div>
      )}

      <div className="archive-list">
        {puzzles.length === 0 && !isSyncing && !initialSyncDone && (
          <div className="archive-empty">טוען תשבצים...</div>
        )}
        {puzzles.length === 0 && !isSyncing && initialSyncDone && (
          <div className="archive-empty">
            {fetchError
              ? `שגיאה: ${fetchError}. לחץ על "רענן" לנסות שוב.`
              : 'לא נמצאו תשבצים. לחץ על "רענן" לנסות שוב.'}
          </div>
        )}
        {puzzles.map(puzzle => (
          <PuzzleCard key={puzzle.id} puzzle={puzzle} onTap={onOpenPuzzle} />
        ))}
      </div>

      <button className="archive-upload-btn" onClick={onManualUpload}>
        העלה תשבץ ידנית
      </button>
    </div>
  );
}

export default ArchiveScreen;
