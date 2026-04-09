import React from 'react';
import './ProcessingScreen.css';

function ProcessingScreen({ mode = 'upload' }) {
  return (
    <div className="processing-screen">
      <div className="spinner" />
      {mode === 'upload' ? (
        <>
          <p className="processing-text">מעבד תמונה...</p>
          <p className="processing-sub">מחלץ רשת ורמזים</p>
        </>
      ) : (
        <p className="processing-text">טוען תשבץ...</p>
      )}
    </div>
  );
}

export default ProcessingScreen;
