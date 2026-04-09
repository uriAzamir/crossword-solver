import { useState } from 'react';

const STORAGE_KEY = 'crossword_user';

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined; // never chosen → show login screen
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'guest') return null; // chose guest previously
    if (parsed?.id && parsed?.username) return parsed; // logged-in user
    return undefined; // invalid data → show login screen
  } catch {
    return undefined;
  }
}

export function useCurrentUser() {
  const [currentUser, setCurrentUserState] = useState(loadUser);

  const setCurrentUser = (user) => {
    if (user === undefined) {
      // Logout: clear storage so login screen shows next visit
      localStorage.removeItem(STORAGE_KEY);
    } else if (user === null) {
      // Guest: remember the choice so login screen is skipped next visit
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'guest' }));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
    setCurrentUserState(user);
  };

  return { currentUser, setCurrentUser };
}
