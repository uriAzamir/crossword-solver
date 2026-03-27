import React, { useState, useRef, useEffect } from 'react';
import './ClueItem.css';

function ClueItem({ clue, isActive, onTap, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(clue.text);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(clue.text);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim() !== clue.text) {
      onEdit(draft.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
    e.stopPropagation();
  };

  return (
    <div
      className={`clue-item ${isActive ? 'clue-item--active' : ''}`}
      onClick={() => !editing && onTap(clue.number)}
    >
      <span className="clue-item-number">{clue.number}.</span>

      {editing ? (
        <input
          ref={inputRef}
          className="clue-item-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          dir="rtl"
          lang="he"
        />
      ) : (
        <span className="clue-item-text">
          {clue.text}
          {clue.length && <span className="clue-item-length"> ({clue.length})</span>}
        </span>
      )}

      {isActive && !editing && (
        <button className="clue-edit-btn" onClick={startEdit} title="ערוך רמז">
          ✏️
        </button>
      )}
    </div>
  );
}

export default React.memo(ClueItem);
