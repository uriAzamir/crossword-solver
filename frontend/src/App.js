import React, { useState, useEffect } from 'react';
import UploadScreen from './components/UploadScreen';
import ProcessingScreen from './components/ProcessingScreen';
import SolverScreen from './components/SolverScreen';
import { usePuzzleState } from './hooks/usePuzzleState';
import './App.css';

function App() {
  const [screen, setScreen] = useState('upload');
  const [uploadError, setUploadError] = useState('');

  const {
    puzzle,
    letters,
    activeCell,
    hasSavedPuzzle,
    savedPuzzle,
    savedLetters,
    loadPuzzle,
    newPuzzle,
    handleCellTap,
    handleLetterInput,
    handleBackspace,
    handleArrow,
    getActiveWord,
    editClue,
  } = usePuzzleState();

  useEffect(() => {
    if (savedPuzzle) {
      loadPuzzle(savedPuzzle, savedLetters);
      setScreen('solver');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePuzzleLoaded = (puzzleData) => {
    loadPuzzle(puzzleData);
    setScreen('solver');
  };

  const handleProcessingError = (msg) => {
    setUploadError(msg);
    setScreen('upload');
  };

  const handleNewPuzzle = () => {
    newPuzzle();
    setUploadError('');
    setScreen('upload');
  };

  const activeWord = getActiveWord();

  return (
    <div className="app">
      {screen === 'upload' && (
        <UploadScreen
          onPuzzleLoaded={handlePuzzleLoaded}
          onProcessingStart={() => { setUploadError(''); setScreen('processing'); }}
          onProcessingError={handleProcessingError}
          initialError={uploadError}
          hasSavedPuzzle={hasSavedPuzzle}
          onResume={() => {
            if (savedPuzzle) {
              loadPuzzle(savedPuzzle, savedLetters);
              setScreen('solver');
            }
          }}
        />
      )}
      {screen === 'processing' && <ProcessingScreen />}
      {screen === 'solver' && puzzle && (
        <SolverScreen
          puzzle={puzzle}
          letters={letters}
          activeCell={activeCell}
          activeWord={activeWord}
          onCellTap={handleCellTap}
          onLetterInput={handleLetterInput}
          onBackspace={handleBackspace}
          onArrow={handleArrow}
          onNewPuzzle={handleNewPuzzle}
          onEditClue={editClue}
        />
      )}
    </div>
  );
}

export default App;
