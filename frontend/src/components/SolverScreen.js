import React, { useCallback, useMemo, useRef, useState } from 'react';
import CrosswordGrid from './CrosswordGrid';
import ClueDisplay from './ClueDisplay';
import ClueList from './ClueList';
import { useKeyboard } from '../hooks/useKeyboard';
import { getWordCells } from '../utils/puzzleUtils';
import './SolverScreen.css';

function SolverScreen({
  puzzle,
  letters,
  activeCell,
  activeWord,
  onCellTap,
  onJumpToClue,
  onLetterInput,
  onBackspace,
  onArrow,
  onNewPuzzle,
  backLabel = 'העלה תשבץ חדש',
  onEditClue,
  imageUrl,
}) {

  const contentRef = useRef(null);
  const [showImage, setShowImage] = useState(false);

  const solvedClues = useMemo(() => {
    if (!puzzle) return new Set();
    const solved = new Set();
    const { grid } = puzzle;
    const checkDirection = (clueList, direction) => {
      for (const clue of clueList) {
        let startRow = -1, startCol = -1;
        outer: for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            if (grid.cells[r][c].number === clue.number) {
              startRow = r; startCol = c; break outer;
            }
          }
        }
        if (startRow === -1) continue;
        const wordCells = getWordCells(grid, startRow, startCol, direction);
        if (wordCells.every(([r, c]) => letters[`${r},${c}`])) {
          solved.add(`${direction}-${clue.number}`);
        }
      }
    };
    checkDirection(puzzle.clues.across, 'across');
    checkDirection(puzzle.clues.down, 'down');
    return solved;
  }, [puzzle, letters]);

  const { inputRef, focusInput, handleInput, handleKeyDown } = useKeyboard({
    onLetter: onLetterInput,
    onBackspace,
    onArrow,
    active: !!activeCell,
  });

  const handleGridTap = useCallback((row, col) => {
    onCellTap(row, col);
    focusInput();
  }, [onCellTap, focusInput]);

  const handleClueSelect = useCallback((number, direction) => {
    const clueList = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
    const clue = clueList.find(c => c.number === number);
    if (!clue) return;
    const { rows, cols, cells } = puzzle.grid;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r][c].number === number) {
          onJumpToClue(r, c, direction);
          focusInput();
          contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }
  }, [puzzle, onJumpToClue, focusInput]);

  const navigateClue = useCallback((direction) => {
    if (!activeWord || !puzzle) return;
    const allClues = [
      ...puzzle.clues.across.map(c => ({ ...c, direction: 'across' })),
      ...puzzle.clues.down.map(c => ({ ...c, direction: 'down' })),
    ];
    const currentIdx = allClues.findIndex(
      c => c.direction === activeWord.direction && c.number === activeWord.number
    );
    if (currentIdx === -1) return;

    const step = direction === 'next' ? 1 : -1;
    let idx = (currentIdx + step + allClues.length) % allClues.length;
    let attempts = 0;
    while (
      attempts < allClues.length &&
      solvedClues.has(`${allClues[idx].direction}-${allClues[idx].number}`)
    ) {
      idx = (idx + step + allClues.length) % allClues.length;
      attempts++;
    }
    // If every clue is solved, fall back to simple next/prev without skipping
    if (attempts === allClues.length) {
      idx = (currentIdx + step + allClues.length) % allClues.length;
    }
    const next = allClues[idx];
    handleClueSelect(next.number, next.direction);
  }, [activeWord, puzzle, solvedClues, handleClueSelect]);

  return (
    <div className="solver-screen">
      {/* Hidden contenteditable div to capture keyboard on mobile — avoids Chrome iOS autofill toolbar */}
      <div
        ref={inputRef}
        className="hidden-input"
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        lang="he"
        inputMode="text"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />

      <div className="solver-bottom-bar">
        <div className="clue-nav-row">
          <button className="clue-nav-btn" onClick={() => navigateClue('prev')} disabled={!activeWord}>‹</button>
          <ClueDisplay activeWord={activeWord} />
          <button className="clue-nav-btn" onClick={() => navigateClue('next')} disabled={!activeWord}>›</button>
        </div>
      </div>

      <div className="solver-content" ref={contentRef}>
        <div className="solver-grid-area">
          <CrosswordGrid
            grid={puzzle.grid}
            letters={letters}
            activeCell={activeCell}
            activeWord={activeWord}
            onCellTap={handleGridTap}
          />
        </div>

        <ClueList
          clues={puzzle.clues}
          activeWord={activeWord}
          solvedClues={solvedClues}
          onClueSelect={handleClueSelect}
          onEditClue={onEditClue}
        />

        {imageUrl && (
          <button className="upload-new-btn" onClick={() => setShowImage(true)}>
            צפה בתמונה המקורית
          </button>
        )}
        <button className="upload-new-btn" onClick={onNewPuzzle}>
          {backLabel}
        </button>
      </div>
      {showImage && (
        <div className="image-overlay" onClick={() => setShowImage(false)}>
          <button className="image-overlay-close" onClick={() => setShowImage(false)}>✕</button>
          <img
            src={imageUrl}
            alt="תמונה מקורית"
            className="image-overlay-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default SolverScreen;
