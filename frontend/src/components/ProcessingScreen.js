import React from 'react';
import './ProcessingScreen.css';

function ProcessingScreen() {
  return (
    <div className="processing-screen">
      <div className="spinner" />
      <p className="processing-text">מעבד תמונה...</p>
      <p className="processing-sub">מחלץ רשת ורמזים</p>
    </div>
  );
}

export default ProcessingScreen;
