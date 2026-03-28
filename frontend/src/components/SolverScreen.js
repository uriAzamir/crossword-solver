import React, { useCallback, useState } from 'react';
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
  const [showClues, setShowClues] = useState(false);

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
          onCellTap(r, c);
          focusInput();
          return;
        }
      }
    }
  }, [puzzle, onCellTap, focusInput]);

  const openClues = () => {
    inputRef.current?.blur();
    setShowClues(true);
  };

  const closeClues = () => {
    setShowClues(false);
    setTimeout(focusInput, 100);
  };

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

      <button className="clues-toggle-btn" onClick={openClues}>
        רשימת רמזים
      </button>

      {showClues && (
        <div className="clues-overlay">
          <div className="clues-overlay-header">
            <span>רמזים</span>
            <button className="clues-overlay-close" onClick={closeClues}>✕</button>
          </div>
          <div className="clues-overlay-body">
            <ClueList
              clues={puzzle.clues}
              activeWord={activeWord}
              onClueSelect={(number, direction) => { handleClueSelect(number, direction); closeClues(); }}
              onEditClue={onEditClue}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SolverScreen;
