import React, { useEffect, useRef } from 'react';
import ClueItem from './ClueItem';
import './ClueList.css';

function ClueList({ clues, activeWord, onClueSelect, onEditClue }) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeWord]);

  const renderSection = (title, clueList, direction) => (
    <div className="clue-section">
      <h3 className="clue-section-title">{title}</h3>
      {clueList.map(clue => {
        const isActive =
          activeWord &&
          activeWord.direction === direction &&
          activeWord.number === clue.number;

        return (
          <div key={clue.number} ref={isActive ? activeRef : null}>
            <ClueItem
              clue={clue}
              isActive={isActive}
              onTap={(num) => onClueSelect(num, direction)}
              onEdit={(newText) => onEditClue(direction, clue.number, newText)}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="clue-list">
      {renderSection('מאוזן', clues.across, 'across')}
      {renderSection('מאונך', clues.down, 'down')}
    </div>
  );
}

export default ClueList;
