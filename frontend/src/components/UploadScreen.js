import React, { useRef, useState } from 'react';
import { processPuzzleImage } from '../utils/apiClient';
import './UploadScreen.css';

function UploadScreen({ onPuzzleLoaded, onProcessingStart, onProcessingError, initialError, hasSavedPuzzle, onResume }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState(initialError || '');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('אנא העלה קובץ תמונה');
      return;
    }

    onProcessingStart();
    try {
      const puzzle = await processPuzzleImage(file);
      onPuzzleLoaded(puzzle);
    } catch (err) {
      const msg = err.message || 'שגיאה בעיבוד התמונה. אנא נסה שוב.';
      if (onProcessingError) {
        onProcessingError(msg);
      } else {
        setError(msg);
      }
    }
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div className="upload-screen">
      <div className="upload-header">
        <h1 className="upload-title">תשבץ</h1>
        <p className="upload-subtitle">פותר תשבצים בעברית</p>
      </div>

      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
        <div className="upload-icon">📷</div>
        <p className="upload-primary">העלה תמונת תשבץ</p>
        <p className="upload-secondary">לחץ לבחירת תמונה או צלם ישירות</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>

      {error && (
        <div className="upload-error">{error}</div>
      )}

      {hasSavedPuzzle && (
        <button className="resume-button" onClick={onResume}>
          המשך פאזל קודם
        </button>
      )}
    </div>
  );
}

export default UploadScreen;
