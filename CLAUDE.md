# Hebrew Crossword Solver

Mobile-first web app for solving Hebrew cryptic crossword puzzles. Upload a puzzle image → get an interactive solving grid.

## Architecture

- **Frontend**: React (CRA), mobile-first, RTL Hebrew layout
- **Backend**: Python/Flask, OpenCV grid extraction, Claude Sonnet clue extraction

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
# Runs on http://localhost:5001
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
- Grid columns are reversed after detection so col index 0 = rightmost visual cell (RTL)
- Left/right arrow keys are also swapped in `usePuzzleState.js` to account for RTL navigation

## Deployment

### Backend → Render

1. Push the `backend/` folder (or the whole repo) to GitHub
2. In [render.com](https://render.com): New → Web Service → connect repo
   - Root directory: `backend`
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
3. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your key
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app` (fill in after Vercel deploy)
4. Deploy — note the service URL (e.g. `https://crossword-solver-backend.onrender.com`)

> Free tier spins down after 15 min of inactivity; first request after sleep takes ~30 s.
> Tesseract OCR is not available on Render's default image — the app falls back to algorithmic numbering automatically.

### Frontend → Vercel

1. Push the `frontend/` folder (or whole repo) to GitHub
2. In [vercel.com](https://vercel.com): New Project → import repo
   - Root directory: `frontend`
   - Framework preset: Create React App (auto-detected)
3. Under **Environment Variables**, add:
   - `REACT_APP_API_URL` = `https://your-render-service.onrender.com/api`
4. Deploy. Once you have the Vercel URL, go back to Render and update `ALLOWED_ORIGINS`.

### Local development with production backend

Set `REACT_APP_API_URL` in `frontend/.env` to your Render URL, or keep `http://localhost:5001/api` for fully local dev.
