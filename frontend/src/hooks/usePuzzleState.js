import { useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getWordAtCell, getNextCell, getPrevCell, canGoAcross, canGoDown } from '../utils/puzzleUtils';

const STORAGE_KEY = 'crossword_puzzle';

export function usePuzzleState() {
  const [saved, setSaved, clearSaved] = useLocalStorage(STORAGE_KEY, null);

  const [puzzle, setPuzzle] = useState(saved?.puzzle || null);
  const [letters, setLetters] = useState(saved?.letters || {});
  const [activeCell, setActiveCell] = useState(null);

  const saveTimerRef = useRef(null);

  const debouncedSave = useCallback((newPuzzle, newLetters) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaved({
        version: 1,
        savedAt: new Date().toISOString(),
        puzzle: newPuzzle,
        letters: newLetters,
      });
    }, 500);
  }, [setSaved]);

  const loadPuzzle = useCallback((puzzleData, existingLetters = {}) => {
    setPuzzle(puzzleData);
    setLetters(existingLetters);
    setActiveCell(null);
    debouncedSave(puzzleData, existingLetters);
  }, [debouncedSave]);

  const newPuzzle = useCallback(() => {
    setPuzzle(null);
    setLetters({});
    setActiveCell(null);
    clearSaved();
  }, [clearSaved]);

  const handleCellTap = useCallback((row, col) => {
    if (!puzzle) return;
    const cell = puzzle.grid.cells[row][col];
    if (cell.blocked) return;

    setActiveCell(prev => {
      if (prev && prev.row === row && prev.col === col) {
        // Same cell: toggle direction
        const newDir = prev.direction === 'across' ? 'down' : 'across';
        const canNew = newDir === 'across'
          ? canGoAcross(puzzle.grid, row, col)
          : canGoDown(puzzle.grid, row, col);
        if (!canNew) return prev;
        return { row, col, direction: newDir };
      }
      // New cell: default to across, fall back to down
      const dir = canGoAcross(puzzle.grid, row, col) ? 'across' : 'down';
      return { row, col, direction: dir };
    });
  }, [puzzle]);

  const handleLetterInput = useCallback((letter) => {
    if (!activeCell || !puzzle) return;
    const { row, col, direction } = activeCell;

    const key = `${row},${col}`;
    const newLetters = { ...letters, [key]: letter };
    setLetters(newLetters);
    debouncedSave(puzzle, newLetters);

    // Advance to next cell
    const next = getNextCell(puzzle.grid, row, col, direction);
    if (next) {
      setActiveCell({ row: next[0], col: next[1], direction });
    }
  }, [activeCell, puzzle, letters, debouncedSave]);

  const handleBackspace = useCallback(() => {
    if (!activeCell || !puzzle) return;
    const { row, col, direction } = activeCell;
    const key = `${row},${col}`;

    if (letters[key]) {
      // Clear current cell
      const newLetters = { ...letters };
      delete newLetters[key];
      setLetters(newLetters);
      debouncedSave(puzzle, newLetters);
    } else {
      // Move back and clear
      const prev = getPrevCell(puzzle.grid, row, col, direction);
      if (prev) {
        const prevKey = `${prev[0]},${prev[1]}`;
        const newLetters = { ...letters };
        delete newLetters[prevKey];
        setLetters(newLetters);
        setActiveCell({ row: prev[0], col: prev[1], direction });
        debouncedSave(puzzle, newLetters);
      }
    }
  }, [activeCell, puzzle, letters, debouncedSave]);

  const handleJumpToClue = useCallback((row, col, direction) => {
    if (!puzzle) return;
    const cell = puzzle.grid.cells[row][col];
    if (cell.blocked) return;
    setActiveCell({ row, col, direction });
  }, [puzzle]);

  const handleArrow = useCallback((arrowDirection) => {
    if (!activeCell || !puzzle) return;
    const { row, col } = activeCell;
    const { rows, cols, cells } = puzzle.grid;

    const moves = {
      ArrowUp:    [-1,  0, 'down'],
      ArrowDown:  [ 1,  0, 'down'],
      ArrowLeft:  [ 0, +1, 'across'],  // RTL: left arrow → higher col index (visually leftward)
      ArrowRight: [ 0, -1, 'across'],  // RTL: right arrow → lower col index (visually rightward)
    };

    const move = moves[arrowDirection];
    if (!move) return;

    const [dr, dc, newDir] = move;
    const newRow = row + dr;
    const newCol = col + dc;

    if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) return;
    if (cells[newRow][newCol].blocked) return;

    setActiveCell({ row: newRow, col: newCol, direction: newDir });
  }, [activeCell, puzzle]);

  const getActiveWord = useCallback(() => {
    if (!activeCell || !puzzle) return null;
    const { row, col, direction } = activeCell;
    return getWordAtCell(puzzle.grid, row, col, direction, puzzle.clues);
  }, [activeCell, puzzle]);

  const editClue = useCallback((direction, number, newText) => {
    if (!puzzle) return;
    const newClues = {
      ...puzzle.clues,
      [direction]: puzzle.clues[direction].map(c =>
        c.number === number ? { ...c, text: newText } : c
      ),
    };
    const newPuzzleData = { ...puzzle, clues: newClues };
    setPuzzle(newPuzzleData);
    debouncedSave(newPuzzleData, letters);
  }, [puzzle, letters, debouncedSave]);

  const hasSavedPuzzle = saved?.puzzle != null;

  return {
    puzzle,
    letters,
    activeCell,
    hasSavedPuzzle,
    loadPuzzle,
    newPuzzle,
    handleCellTap,
    handleJumpToClue,
    handleLetterInput,
    handleBackspace,
    handleArrow,
    getActiveWord,
    editClue,
    // Restore saved puzzle on mount
    savedPuzzle: saved?.puzzle || null,
    savedLetters: saved?.letters || {},
  };
}
