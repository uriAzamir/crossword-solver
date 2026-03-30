import React, { useCallback, useMemo, useRef } from 'react';
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
  onEditClue,
}) {

  const contentRef = useRef(null);

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

        <button className="upload-new-btn" onClick={onNewPuzzle}>
          העלה תשבץ חדש
        </button>
      </div>
    </div>
  );
}

export default SolverScreen;
