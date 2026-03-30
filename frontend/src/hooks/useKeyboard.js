import { useEffect, useRef, useCallback } from 'react';

const HEBREW_RANGE = /^[\u05D0-\u05EA]$/;

export function useKeyboard({ onLetter, onBackspace, onArrow, active }) {
  const inputRef = useRef(null);

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  // Keep hidden input focused when puzzle is active
  useEffect(() => {
    if (active) {
      focusInput();
    }
  }, [active, focusInput]);

  // Handle input event (primary — works reliably on mobile IMEs)
  const handleInput = useCallback((e) => {
    const value = e.target.textContent;
    if (!value) return;

    // Clear immediately to prevent accumulation
    e.target.textContent = '';

    // Take last character (in case IME composed multiple)
    const char = value[value.length - 1];
    if (HEBREW_RANGE.test(char)) {
      onLetter(char);
    }
  }, [onLetter]);

  // Handle keydown for backspace and arrows (these fire reliably even on mobile)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      onBackspace();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      onArrow(e.key);
    } else if (HEBREW_RANGE.test(e.key)) {
      // Desktop: handle Hebrew keydown directly
      e.preventDefault();
      onLetter(e.key);
    }
  }, [onBackspace, onArrow, onLetter]);

  return { inputRef, focusInput, handleInput, handleKeyDown };
}
