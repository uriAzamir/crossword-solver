import React, { useState, useEffect, useCallback } from 'react';
import UploadScreen from './components/UploadScreen';
import ProcessingScreen from './components/ProcessingScreen';
import SolverScreen from './components/SolverScreen';
import ArchiveScreen from './components/ArchiveScreen';
import { usePuzzleState } from './hooks/usePuzzleState';
import { loadProgress, saveProgress } from './hooks/usePuzzleProgress';
import { fetchPuzzle, updatePuzzleClues } from './utils/apiClient';
import './App.css';

function App() {
  const [screen, setScreen] = useState('archive');
  const [activePuzzleId, setActivePuzzleId] = useState(null);
  const [activePuzzleImageUrl, setActivePuzzleImageUrl] = useState(null);
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
    handleJumpToClue,
    handleLetterInput,
    handleBackspace,
    handleArrow,
    getActiveWord,
    editClue,
  } = usePuzzleState();

  // Save progress to per-puzzle key whenever letters change in archive flow
  useEffect(() => {
    if (activePuzzleId && letters && Object.keys(letters).length > 0) {
      saveProgress(activePuzzleId, letters);
    }
  }, [letters, activePuzzleId]);

  // Open a puzzle from the archive
  const handleOpenArchivePuzzle = async (puzzleId) => {
    setScreen('processing');
    try {
      const data = await fetchPuzzle(puzzleId);
      const saved = loadProgress(puzzleId);
      setActivePuzzleId(puzzleId);
      setActivePuzzleImageUrl(data.image_public_url || null);
      loadPuzzle(data.processed_data, saved);
      setScreen('solver');
    } catch {
      setScreen('archive');
    }
  };

  const handleBackToArchive = () => {
    setActivePuzzleId(null);
    setActivePuzzleImageUrl(null);
    newPuzzle();
    setScreen('archive');
  };

  const handleManualUpload = () => {
    setActivePuzzleId(null);
    setUploadError('');
    setScreen('upload');
  };

  // Manual upload flow handlers
  const handlePuzzleLoaded = (puzzleData) => {
    loadPuzzle(puzzleData);
    setScreen('solver');
  };

  const handleProcessingError = (msg) => {
    setUploadError(msg);
    setScreen('upload');
  };

  const handleEditClue = useCallback((direction, number, newText) => {
    editClue(direction, number, newText);
    if (activePuzzleId && puzzle) {
      const newClues = {
        ...puzzle.clues,
        [direction]: puzzle.clues[direction].map(c =>
          c.number === number ? { ...c, text: newText } : c
        ),
      };
      updatePuzzleClues(activePuzzleId, newClues).catch(() => {});
    }
  }, [editClue, activePuzzleId, puzzle]);

  const activeWord = getActiveWord();

  return (
    <div className="app">
      {screen === 'archive' && (
        <ArchiveScreen
          onOpenPuzzle={handleOpenArchivePuzzle}
          onManualUpload={handleManualUpload}
        />
      )}
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
          onJumpToClue={handleJumpToClue}
          onLetterInput={handleLetterInput}
          onBackspace={handleBackspace}
          onArrow={handleArrow}
          onNewPuzzle={activePuzzleId ? handleBackToArchive : handleManualUpload}
          backLabel={activePuzzleId ? 'חזור לארכיון' : 'העלה תשבץ חדש'}
          onEditClue={handleEditClue}
          imageUrl={activePuzzleImageUrl}
        />
      )}
    </div>
  );
}

export default App;
