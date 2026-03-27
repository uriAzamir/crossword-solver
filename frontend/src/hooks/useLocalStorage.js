import { useState } from 'react';

const STORAGE_VERSION = 1;

export function useLocalStorage(key, defaultValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return defaultValue;
      const parsed = JSON.parse(item);
      if (parsed?.version !== STORAGE_VERSION) return defaultValue;
      return parsed;
    } catch {
      return defaultValue;
    }
  });

  const setValue = (value) => {
    try {
      const toStore = typeof value === 'function' ? value(storedValue) : value;
      setStoredValue(toStore);
      window.localStorage.setItem(key, JSON.stringify(toStore));
    } catch {
      // ignore write errors
    }
  };

  const removeValue = () => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(defaultValue);
    } catch {
      // ignore
    }
  };

  return [storedValue, setValue, removeValue];
}
