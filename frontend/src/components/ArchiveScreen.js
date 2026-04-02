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

// 4 columns × 3 rows mini crossword grid.
// Cells 1 and 10 are fixed "black" cells (rotationally symmetric) — purely decorative.
// The remaining 10 cells fill in based on solving progress.
const COLS = 4;
const ROWS = 4;
// Diagonal scatter — rotationally symmetric, looks like a real crossword
const BLACK = new Set([3, 6, 9, 12]);
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

function PuzzleCard({ puzzle, onTap }) {
  const letterCount = getProgressCount(puzzle.id);

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
