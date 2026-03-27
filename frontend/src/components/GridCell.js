import React from 'react';
import './GridCell.css';

function GridCell({ cell, letter, highlight, onTap, rowIndex, colIndex }) {
  if (cell.blocked) {
    return <div className="grid-cell blocked" />;
  }

  return (
    <div
      className={`grid-cell ${highlight}`}
      onClick={() => onTap(rowIndex, colIndex)}
    >
      {cell.number && (
        <span className="cell-number">{cell.number}</span>
      )}
      <span className="cell-letter">{letter || ''}</span>
    </div>
  );
}

export default React.memo(GridCell);
