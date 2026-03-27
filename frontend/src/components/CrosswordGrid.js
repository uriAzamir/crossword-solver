import React, { useMemo } from 'react';
import GridCell from './GridCell';
import './CrosswordGrid.css';

function CrosswordGrid({ grid, letters, activeCell, activeWord, onCellTap }) {
  const { rows, cols, cells } = grid;

  const activeCellSet = useMemo(() => {
    if (!activeCell) return new Set();
    return new Set([`${activeCell.row},${activeCell.col}`]);
  }, [activeCell]);

  const activeWordSet = useMemo(() => {
    if (!activeWord) return new Set();
    return new Set(activeWord.cells.map(([r, c]) => `${r},${c}`));
  }, [activeWord]);

  return (
    <div
      className="crossword-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {cells.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          const isActive = activeCellSet.has(key);
          const inWord = activeWordSet.has(key);
          const highlight = isActive
            ? 'highlight-active'
            : inWord
            ? 'highlight-word'
            : '';

          return (
            <GridCell
              key={key}
              cell={cell}
              letter={letters[key] || ''}
              highlight={highlight}
              onTap={onCellTap}
              rowIndex={r}
              colIndex={c}
            />
          );
        })
      )}
    </div>
  );
}

export default React.memo(CrosswordGrid);
