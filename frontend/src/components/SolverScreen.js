import React, { useCallback, useEffect } from 'react';
import CrosswordGrid from './CrosswordGrid';
import ClueDisplay from './ClueDisplay';
import ClueList from './ClueList';
import { useKeyboard } from '../hooks/useKeyboard';
import './SolverScreen.css';

function SolverScreen({
  puzzle,
  letters,
  activeCell,
  activeWord,
  onCellTap,
  onLetterInput,
  onBackspace,
  onArrow,
  onNewPuzzle,
  onEditClue,
}) {
  const { inputRef, focusInput, handleInput, handleKeyDown } = useKeyboard({
    onLetter: onLetterInput,
    onBackspace,
    onArrow,
    active: !!activeCell,
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-height', `${offset}px`);
    };
    vv.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--keyboard-height');
    };
  }, []);

  const handleGridTap = useCallback((row, col) => {
    onCellTap(row, col);
    focusInput();
  }, [onCellTap, focusInput]);

  const handleClueSelect = useCallback((number, direction) => {
    // Find the first cell of that word and activate it
    const clueList = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
    const clue = clueList.find(c => c.number === number);
    if (!clue) return;

    // Find the numbered cell in the grid
    const { rows, cols, cells } = puzzle.grid;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r][c].number === number) {
          onCellTap(r, c);
          focusInput();
          return;
        }
      }
    }
  }, [puzzle, onCellTap, focusInput]);

  return (
    <div className="solver-screen">
      {/* Hidden input to capture keyboard on mobile */}
      <input
        ref={inputRef}
        className="hidden-input"
        type="text"
        inputMode="text"
        dir="rtl"
        lang="he"
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="new-password"
        spellCheck="false"
        data-form-type="other"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        readOnly={false}
      />

      <div className="solver-topbar">
        <ClueDisplay activeWord={activeWord} />
        <button className="new-puzzle-btn" onClick={onNewPuzzle} title="תשבץ חדש">
          ✕
        </button>
      </div>

      <div className="solver-grid-area">
        <CrosswordGrid
          grid={puzzle.grid}
          letters={letters}
          activeCell={activeCell}
          activeWord={activeWord}
          onCellTap={handleGridTap}
        />
      </div>

      <div className="solver-clues-area">
        <ClueList
          clues={puzzle.clues}
          activeWord={activeWord}
          onClueSelect={handleClueSelect}
          onEditClue={onEditClue}
        />
      </div>
    </div>
  );
}

export default SolverScreen;
