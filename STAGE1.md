# Stage 1 — Hebrew Crossword Solver (Complete)

## Overview

A mobile-first web app for solving Hebrew cryptic crossword puzzles. The user uploads a puzzle image; the backend extracts the grid and clues; the frontend renders an interactive solving experience.

**Live URLs**
- Frontend: https://crossword-solver-mu.vercel.app/
- Backend: Render (Python/Flask)

---

## Features

### Image Processing
- Upload PNG/JPG puzzle image via drag-and-drop or file picker
- Backend detects and removes the light-blue title bar (HSV detection)
- Splits content region: right 38% = grid, left 62% = clues
- Grid lines detected via HoughLinesP with morphological fallback
- Detected lines regularised (remove double-detected borders, insert missing interior lines)
- Cells classified as blocked (dark) or open (light)
- Cell numbering via Tesseract OCR with algorithmic fallback
- Clues extracted via Claude vision API (Haiku) with JSON validation + retry

### Interactive Solver
- Tap a cell to activate it; tap the same cell again to toggle across/down direction
- Type Hebrew letters; cursor auto-advances to the next **empty** cell (pre-filled cells are skipped)
- Backspace clears the current cell, or moves back and clears the previous cell
- Arrow keys navigate across words (RTL-aware: left/right are swapped)
- Clue bar at top shows the active clue with direction badge and prev/next arrows
- Prev/next arrows skip clues that are already fully solved
- Full clue list (מאוזן then מאונך) rendered inline below the grid — always visible and scrollable
- Tapping a clue in the list jumps to its first cell in the grid and scrolls back to the top
- Solved words are visually marked in the clue list (green tint, muted strikethrough text)
- Clue text can be edited inline (pencil button appears on active clue)
- "העלה תשבץ חדש" button at the bottom resets and returns to upload

### Persistence
- Progress auto-saved to `localStorage` with 500 ms debounce
- On reload, the saved puzzle is restored automatically
- localStorage key: `crossword_puzzle`, schema version 1 — stale versions discarded

### Mobile Optimisations
- Hidden `contentEditable` div (not `<input>`) triggers the native Hebrew keyboard on iOS without the Chrome autofill toolbar
- `dir="rtl"` + `lang="he"` on the hidden element; cleared after each character to prevent accumulation
- `focus({ preventScroll: true })` prevents viewport jumps
- Grid sized at 75% of container width; scrollable content area so keyboard doesn't obscure the grid
- All UI text is in Hebrew; full RTL layout

---

## Architecture

### Frontend (React / CRA, deployed on Vercel)

```
src/
  App.js                     # Screen router: upload → processing → solver
  hooks/
    usePuzzleState.js         # All puzzle logic and state
    useKeyboard.js            # Hidden input, Hebrew character routing
    useLocalStorage.js        # Versioned localStorage wrapper
  components/
    UploadScreen.js/css       # File picker, error display, resume button
    ProcessingScreen.js/css   # Loading spinner
    SolverScreen.js/css       # Main solver layout and clue navigation
    CrosswordGrid.js/css      # CSS grid rendering all cells
    GridCell.js/css           # Individual cell (number, letter, highlight states)
    ClueList.js/css           # Across + down sections
    ClueItem.js/css           # Single clue row with edit + solved states
    ClueDisplay.js/css        # Active clue display in top bar
  utils/
    puzzleUtils.js            # getWordCells, getNextCell, getPrevCell, canGoAcross/Down
    apiClient.js              # processPuzzleImage, checkHealth
```

### Backend (Python/Flask, deployed on Render)

```
backend/
  app.py                     # Flask routes: GET /api/health, POST /api/process
  services/
    image_processor.py       # Orchestrates title strip → grid → clue extraction
    grid_extractor.py        # OpenCV pipeline: threshold → lines → cells → numbering
    clue_extractor.py        # Claude vision API call + validation + retry
  requirements.txt
  .env.example
```

### Data Flow

```
User uploads image
  → POST /api/process
  → Strip title bar (HSV blue)
  → Split: grid region (right 38%) + clue region (left 62%)
  → grid_extractor: threshold → Hough lines → regularise → classify cells → reverse cols → number cells
  → clue_extractor: base64 encode → Claude Haiku → validate JSON → retry if needed
  → Return {grid: {rows, cols, cells}, clues: {across, down}}
  → Frontend: loadPuzzle() → localStorage → SolverScreen renders
```

---

## Key Technical Decisions

| Area | Decision | Reason |
|------|----------|--------|
| RTL layout | `direction: rtl` on CSS grid; col index 0 = rightmost visual cell | Hebrew puzzles read right-to-left |
| Column reversal | Backend reverses columns after extraction | Image scans LTR; logical layout is RTL |
| Mobile input | Hidden `contentEditable` div instead of `<input>` | `<input>` triggers iOS Chrome autofill toolbar; contentEditable does not |
| Clue extraction | Claude vision API (not OCR) | Hebrew OCR unreliable; Claude handles varied formatting and wordplay hints |
| Cell numbering | Tesseract OCR → algorithmic fallback | Tesseract unavailable on Render; algorithmic is reliable for standard grids |
| Line detection | HoughLinesP → morphological fallback | Handles image quality variance; prevents crashes |
| Line regularisation | Remove doubles (< 60% median gap), insert missing (> 160% median gap) | Raw Hough output has artifacts; regularisation yields a clean uniform grid |
| Save strategy | 500 ms debounced localStorage | Balances responsiveness with write frequency during typing |
| Skip filled cells | Auto-advance past pre-filled cells on letter input | Lets user type a word naturally when partial answer already exists |
| Skip solved clues | Clue nav arrows skip fully completed words | Avoids navigating to already-done work; falls back to linear if all solved |
| Solved detection | `useMemo` over `letters` + `puzzle.grid` | Recomputes only when letters or puzzle change; no extra state |

---

## Deployment

### Backend → Render
- Root: `backend/`
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- Env vars: `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`
- Free tier cold start: ~30 s after 15 min inactivity

### Frontend → Vercel
- Root: `frontend/`
- Framework: Create React App
- Env var: `REACT_APP_API_URL` = Render service URL + `/api`

### Local Development
```bash
# Backend
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
python app.py   # http://localhost:5001

# Frontend
cd frontend && npm install && npm start   # http://localhost:3000
```
