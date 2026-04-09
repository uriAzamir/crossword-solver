import React, { useState } from 'react';
import { createUser, getUserByName, bulkImportProgress } from '../utils/apiClient';
import { loadProgress } from '../hooks/usePuzzleProgress';
import './LoginScreen.css';

async function migrateLocalProgress(userId) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('crossword_progress_')) continue;
    const puzzleId = key.replace('crossword_progress_', '');
    const letters = loadProgress(puzzleId);
    if (Object.keys(letters).length > 0) {
      entries.push({ puzzle_id: puzzleId, letters });
    }
  }
  if (entries.length === 0) return;
  await bulkImportProgress(userId, entries);
  entries.forEach(e => localStorage.removeItem(`crossword_progress_${e.puzzle_id}`));
}

function UsernameForm({ mode, onSubmit, onBack }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    setError('');
    setLoading(mode === 'login' ? 'מחפש משתמש...' : 'יוצר משתמש...');

    try {
      if (mode === 'login') {
        const user = await getUserByName(trimmed);
        onSubmit(user);
      } else {
        const user = await createUser(trimmed);
        setLoading('מעביר התקדמות...');
        await migrateLocalProgress(user.id);
        onSubmit(user);
      }
    } catch (err) {
      if (err.status === 404) setError('שם המשתמש לא נמצא');
      else if (err.status === 409) setError('שם המשתמש תפוס');
      else setError('שגיאת חיבור, נסה שוב');
      setLoading('');
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <input
        className="login-input"
        type="text"
        placeholder="שם משתמש"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoFocus
        dir="rtl"
        disabled={!!loading}
      />
      {error && <div className="login-error">{error}</div>}
      {loading && <div className="login-loading">{loading}</div>}
      <button className="login-btn login-btn--primary" type="submit" disabled={!!loading || !username.trim()}>
        {mode === 'login' ? 'כניסה' : 'יצירה'}
      </button>
      <button className="login-btn login-btn--back" type="button" onClick={onBack} disabled={!!loading}>
        חזור
      </button>
    </form>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null); // null | 'login' | 'create'

  const handleUser = (user) => {
    onLogin(user);
  };

  const handleGuest = () => {
    onLogin(null);
  };

  if (mode === 'login' || mode === 'create') {
    return (
      <div className="login-screen">
        <div className="login-title">דקל בנו</div>
        <div className="login-subtitle">
          {mode === 'login' ? 'כניסה עם שם משתמש קיים' : 'יצירת משתמש חדש'}
        </div>
        <UsernameForm mode={mode} onSubmit={handleUser} onBack={() => setMode(null)} />
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-title">דקל בנו</div>
      <div className="login-subtitle">ברוך הבא</div>
      <div className="login-options">
        <button className="login-btn login-btn--primary" onClick={() => setMode('login')}>
          כניסה עם שם משתמש קיים
        </button>
        <button className="login-btn login-btn--primary" onClick={() => setMode('create')}>
          משתמש חדש
        </button>
        <button className="login-btn login-btn--guest" onClick={handleGuest}>
          כניסה כאורח
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;
