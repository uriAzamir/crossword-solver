# Stage 1 — Full Implementation

## What Was Built

Complete end-to-end Hebrew crossword solver.

### Backend (`/backend`)

- `app.py` — Flask app with CORS, registers blueprint
- `routes/puzzle.py` — `POST /api/process` and `GET /api/health`
- `services/image_processor.py` — Orchestrates OpenCV + Claude; strips title bar via HSV blue detection
- `services/grid_extractor.py` — Full OpenCV pipeline: binarize → find grid bounds → detect grid lines via projection profiles → classify cells → assign numbers (OCR with pytesseract, falls back to algorithmic)
- `services/clue_extractor.py` — Sends left 67% to Claude Haiku (claude-haiku-4-5-20251001); parses Hebrew clues in `N. text (count);` format; retries on malformed JSON

### Frontend (`/frontend/src`)

**Components:**
- `UploadScreen` — Camera/file upload with Hebrew error messages
- `ProcessingScreen` — Spinner with Hebrew text while backend processes
- `SolverScreen` — Main layout: ClueDisplay + CrosswordGrid + ClueList + hidden keyboard input
- `CrosswordGrid` — RTL CSS grid, computes cell highlights
- `GridCell` — Single cell: blocked/white, number badge, letter, highlight states
- `ClueDisplay` — Sticky header showing active clue + direction badge
- `ClueList` — Scrollable across/down sections, auto-scrolls to active clue
- `ClueItem` — Single clue row, tappable to navigate to that word

**Hooks:**
- `usePuzzleState` — All interaction state: tap, type, backspace, arrow, active word computation, debounced localStorage save
- `useKeyboard` — Hidden RTL input for mobile Hebrew keyboard; handles `input` event (IME-safe) + `keydown` for backspace/arrows
- `useLocalStorage` — Versioned read/write with automatic stale-data discard

**Utils:**
- `puzzleUtils.js` — `getWordCells`, `getWordAtCell`, `getNextCell`, `getPrevCell`, `canGoAcross`, `canGoDown`
- `apiClient.js` — Fetch wrapper for backend API

### Interaction Model

- Tap cell → across direction (or down if across not possible)
- Tap same cell again → toggle direction
- Type Hebrew letter → fill cell, advance to next cell in word
- Backspace → clear cell or move back
- Arrow keys → navigate cells, switch direction
- Tap clue in list → jump to that word's start cell
- Progress auto-saved to localStorage every 500ms (debounced)
- "✕" button → new puzzle, clears saved state

### Design

- Font: Frank Ruhl Libre (Hebrew serif, Google Fonts)
- Active cell: `#5b9bd5` (blue) with white letter
- Active word: `#cce5ff` (light blue)
- Full RTL layout throughout
- Mobile-first, works at 375px viewport width
