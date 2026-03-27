import React from 'react';
import './ClueItem.css';

function ClueItem({ clue, isActive, onTap }) {
  return (
    <div
      className={`clue-item ${isActive ? 'clue-item--active' : ''}`}
      onClick={() => onTap(clue.number)}
    >
      <span className="clue-item-number">{clue.number}.</span>
      <span className="clue-item-text">
        {clue.text}
        {clue.length && <span className="clue-item-length"> ({clue.length})</span>}
      </span>
    </div>
  );
}

export default React.memo(ClueItem);
