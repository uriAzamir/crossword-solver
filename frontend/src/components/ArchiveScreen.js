import React from 'react';
import { useArchive } from '../hooks/useArchive';
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

// 4 columns × 3 rows mini crossword grid.
// Cells 1 and 10 are fixed "black" cells (rotationally symmetric) — purely decorative.
// The remaining 10 cells fill in based on solving progress.
const COLS = 4;
const ROWS = 4;
// Scattered pattern — rotationally symmetric, mimics real crossword black cells
const BLACK = new Set([2, 4, 11, 13]);
const OPEN_CELLS = COLS * ROWS - BLACK.size; // 12
const ESTIMATED_TOTAL = 60; // typical open-cell count for these puzzles

function MiniProgressGrid({ letterCount }) {
  const ratio = Math.min(letterCount / ESTIMATED_TOTAL, 1);
  // Show at least 1 filled cell as soon as the puzzle is started
  const filled = letterCount === 0 ? 0 : Math.max(1, Math.round(ratio * OPEN_CELLS));
  let openSeen = 0;
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
    if (BLACK.has(i)) return 'black';
    openSeen++;
    return openSeen <= filled ? 'filled' : 'empty';
  });

  return (
    <div className="mini-grid">
      {cells.map((type, i) => (
        <div key={i} className={`mini-cell mini-cell--${type}`} />
      ))}
    </div>
  );
}

function PuzzleCard({ puzzle, onTap, getProgress }) {
  const letterCount = getProgress(puzzle.id);

  return (
    <div className="puzzle-card" onClick={() => onTap(puzzle.id)}>
      <div className="puzzle-card-top">
        <div>
          <div className="puzzle-card-date">{formatHebrewDate(puzzle.published_at)}</div>
          <div className="puzzle-card-title">{puzzle.title}</div>
        </div>
        <MiniProgressGrid letterCount={letterCount} />
      </div>
    </div>
  );
}

function ArchiveScreen({ onOpenPuzzle, onManualUpload, currentUser, onLogout, getProgress }) {
  const { puzzles, isSyncing, initialSyncDone, fetchError, sync } = useArchive();

  return (
    <div className="archive-screen">
      <div className="archive-header">
        <div className="archive-header-right">
          <span className="archive-title">המשבצת</span>
          {currentUser && (
            <span className="archive-user">
              שלום, {currentUser.username}
              <button className="archive-logout-btn" onClick={onLogout}>החלף משתמש</button>
            </span>
          )}
          {!currentUser && (
            <button className="archive-logout-btn" onClick={onLogout}>החלף משתמש</button>
          )}
        </div>
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
          <PuzzleCard key={puzzle.id} puzzle={puzzle} onTap={onOpenPuzzle} getProgress={getProgress} />
        ))}
      </div>

      <button className="archive-upload-btn" onClick={onManualUpload}>
        העלה תשבץ ידנית
      </button>
    </div>
  );
}

export default ArchiveScreen;
