# Hebrew Crossword Solver

Mobile-first web app for solving Hebrew cryptic crossword puzzles. Upload a puzzle image → get an interactive solving grid.

## Architecture

- **Frontend**: React (CRA), mobile-first, RTL Hebrew layout
- **Backend**: Python/Flask, OpenCV grid extraction, Claude Haiku clue extraction

## Setup

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Copy and fill in your API key:
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY=sk-ant-...

python app.py
# Runs on http://localhost:5000
```

Optional: install Tesseract OCR for cell number detection:
- Windows: https://github.com/UB-Mannheim/tesseract/wiki
- macOS: `brew install tesseract`
- Ubuntu: `sudo apt install tesseract-ocr`

If Tesseract is not installed, the app falls back to algorithmic cell numbering (works for most standard crosswords).

### Frontend

```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/process` | Process puzzle image (multipart `image` field) |

## Image Format Expected

- Light blue title bar at top (ignored)
- Content area below: grid on RIGHT ~33%, clues on LEFT ~67%
- Grid: clean black/white digital image, ~9×9 cells
- Clues: RIGHT sub-column = מאוזן (across), LEFT sub-column = מאונך (down)
- Clue format: `1. clue text (5);` — ends with letter count and semicolon

## Key Design Decisions

- `direction: rtl` on the CSS grid container — cell index 0 renders rightmost (correct for Hebrew)
- `getNextCell` for "across" direction increments col index (moves left visually)
- Hidden `<input dir="rtl" lang="he">` kept focused to trigger native Hebrew keyboard on mobile
- Cell numbers assigned algorithmically (or via OCR) — a cell gets a number if it starts an across or down word
- localStorage key `crossword_puzzle` with `version: 1` — stale data is discarded on version bump
