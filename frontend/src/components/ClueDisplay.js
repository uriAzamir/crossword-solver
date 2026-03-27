import React from 'react';
import './ClueDisplay.css';

function ClueDisplay({ activeWord }) {
  if (!activeWord) {
    return (
      <div className="clue-display clue-display--empty">
        <span>בחר תא להתחלה</span>
      </div>
    );
  }

  const directionLabel = activeWord.direction === 'across' ? 'מאוזן' : 'מאונך';
  const lengthLabel = activeWord.length ? `(${activeWord.length})` : '';

  return (
    <div className="clue-display">
      <span className="clue-badge">{directionLabel} {activeWord.number}</span>
      <span className="clue-text">
        {activeWord.clueText} <span className="clue-length">{lengthLabel}</span>
      </span>
    </div>
  );
}

export default ClueDisplay;
