import React, { useState, useEffect, useCallback } from 'react';
import UploadScreen from './components/UploadScreen';
import ProcessingScreen from './components/ProcessingScreen';
import SolverScreen from './components/SolverScreen';
import ArchiveScreen from './components/ArchiveScreen';
import LoginScreen from './components/LoginScreen';
import { usePuzzleState } from './hooks/usePuzzleState';
import { useCurrentUser } from './hooks/useCurrentUser';
import { loadProgress, saveProgress, getProgressCount, loadProgressFromServer, saveProgressToServer } from './hooks/usePuzzleProgress';
import { fetchPuzzle, updatePuzzleClues, fetchUserProgress } from './utils/apiClient';
import './App.css';

function App() {
  const [screen, setScreen] = useState('archive');
  const [activePuzzleId, setActivePuzzleId] = useState(null);
  const [activePuzzleImageUrl, setActivePuzzleImageUrl] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [allProgress, setAllProgress] = useState({});

  const { currentUser, setCurrentUser } = useCurrentUser();
  const isLoggedIn = currentUser !== null; // null = guest, {id, username} = logged in

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

  // Load all progress for the current user when they log in (for archive mini grids)
  useEffect(() => {
    if (!currentUser) {
      // Guest: build progress map from localStorage
      setAllProgress({});
      return;
    }
    fetchUserProgress(currentUser.id)
      .then(data => {
        const counts = Object.fromEntries(
          Object.entries(data).map(([pid, p]) => [pid, Object.keys(p.letters || {}).length])
        );
        setAllProgress(counts);
      })
      .catch(() => setAllProgress({}));
  }, [currentUser]);

  // Save progress whenever letters change while solving an archive puzzle
  useEffect(() => {
    if (!activePuzzleId || !letters || Object.keys(letters).length === 0) return;
    if (currentUser) {
      saveProgressToServer(currentUser.id, activePuzzleId, letters);
      setAllProgress(prev => ({ ...prev, [activePuzzleId]: Object.keys(letters).length }));
    } else {
      saveProgress(activePuzzleId, letters);
    }
  }, [letters, activePuzzleId, currentUser]);

  // Open a puzzle from the archive
  const handleOpenArchivePuzzle = async (puzzleId) => {
    setScreen('processing');
    try {
      const data = await fetchPuzzle(puzzleId);
      const saved = currentUser
        ? await loadProgressFromServer(currentUser.id, puzzleId)
        : loadProgress(puzzleId);
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

  const handleLogin = (user) => {
    // user is {id, username} or null (guest)
    setCurrentUser(user);
    setScreen('archive');
  };

  const handleLogout = () => {
    setCurrentUser(undefined); // undefined triggers login screen
    setAllProgress({});
    setActivePuzzleId(null);
    newPuzzle();
    setScreen('archive');
  };

  // Get progress count for a puzzle (guest falls back to localStorage)
  const getProgress = useCallback((puzzleId) => {
    if (currentUser) return allProgress[puzzleId] ?? 0;
    return getProgressCount(puzzleId);
  }, [currentUser, allProgress]);

  const activeWord = getActiveWord();

  // Show login screen if no user has been chosen yet
  if (currentUser === undefined) {
    return (
      <div className="app">
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'archive' && (
        <ArchiveScreen
          onOpenPuzzle={handleOpenArchivePuzzle}
          onManualUpload={handleManualUpload}
          currentUser={currentUser}
          onLogout={handleLogout}
          getProgress={getProgress}
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
