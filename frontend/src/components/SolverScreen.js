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
  onJumpToClue,
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
          onJumpToClue(r, c, direction);
          focusInput();
          return;
        }
      }
    }
  }, [puzzle, onJumpToClue, focusInput]);

  const navigateClue = useCallback((direction) => {
    if (!activeWord || !puzzle) return;
    const acrossClues = puzzle.clues.across;
    const downClues = puzzle.clues.down;
    const currentList = activeWord.direction === 'across' ? acrossClues : downClues;
    const currentIdx = currentList.findIndex(c => c.number === activeWord.number);

    let nextClue, nextDirection;
    if (direction === 'next') {
      if (currentIdx < currentList.length - 1) {
        nextClue = currentList[currentIdx + 1];
        nextDirection = activeWord.direction;
      } else {
        // wrap to other direction
        const otherList = activeWord.direction === 'across' ? downClues : acrossClues;
        nextClue = otherList[0];
        nextDirection = activeWord.direction === 'across' ? 'down' : 'across';
      }
    } else {
      if (currentIdx > 0) {
        nextClue = currentList[currentIdx - 1];
        nextDirection = activeWord.direction;
      } else {
        // wrap to other direction
        const otherList = activeWord.direction === 'across' ? downClues : acrossClues;
        nextClue = otherList[otherList.length - 1];
        nextDirection = activeWord.direction === 'across' ? 'down' : 'across';
      }
    }
    if (nextClue) handleClueSelect(nextClue.number, nextDirection);
  }, [activeWord, puzzle, handleClueSelect]);

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
      {/* form wrapper suppresses Chrome iOS autofill toolbar */}
      <form autoComplete="off" style={{ position: 'fixed', top: -200, left: -200, width: 1, height: 1, overflow: 'hidden' }}>
        <input
          ref={inputRef}
          className="hidden-input"
          type="text"
          inputMode="text"
          dir="rtl"
          lang="he"
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck="false"
          data-form-type="other"
          data-lpignore="true"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          readOnly={false}
        />
      </form>

      <button className="new-puzzle-btn" onClick={onNewPuzzle} title="תשבץ חדש">
        ✕
      </button>

      <div className="solver-grid-area">
        <CrosswordGrid
          grid={puzzle.grid}
          letters={letters}
          activeCell={activeCell}
          activeWord={activeWord}
          onCellTap={handleGridTap}
        />
      </div>

      <div className="solver-bottom-bar">
        <div className="clue-nav-row">
          <button className="clue-nav-btn" onClick={() => navigateClue('prev')} disabled={!activeWord}>‹</button>
          <ClueDisplay activeWord={activeWord} />
          <button className="clue-nav-btn" onClick={() => navigateClue('next')} disabled={!activeWord}>›</button>
        </div>
        <button className="clues-toggle-btn" onClick={openClues}>
          רשימת רמזים
        </button>
      </div>

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
