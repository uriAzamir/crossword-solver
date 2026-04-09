# Stage 2 — Automatic Puzzle Fetching from Google Group (Complete)

## Goal

Extend the app to automatically fetch new Hebrew crossword puzzles from a public Google Group instead of requiring manual image upload. Keep Stage 1 (manual upload) as a fallback.

**Source:** https://groups.google.com/g/tartey_mashma
**Puzzle posts:** titles starting with "דקל בנו שני" (Monday) or "דקל בנו רביעי" (Wednesday)
**Attachment needed:** PNG only (each post also has a PDF)

---

## What Was Actually Built (vs. Plan)

All 8 planned steps were implemented. The following were added beyond the original plan:

- **Multiple scheduled sync times** — scraper runs 5 times on puzzle days (9 AM, 1 PM, 5 PM, 9 PM, midnight Tue/Thu) instead of once at 9 AM, to catch late uploads
- **Email error notifications** — when a puzzle fails to process, an email is sent (configurable via `SMTP_*` env vars)
- **Clue editing + persistence** — pencil button in clue list lets users fix extraction mistakes; edits are saved back to Supabase (`PATCH /api/puzzles/<id>/clues`)
- **View original image overlay** — "צפה בתמונה המקורית" button in the solver opens the original Supabase-stored image in an in-app overlay
- **`reprocess_all.py`** — standalone script to re-run extraction on all stored puzzles after algorithm improvements

## Implementation Steps

---

### Step 0 — Manual Scraping Verification (Go/No-Go Gate)

**No code committed. Pure investigation.**

Write a throwaway local Python script that:
1. GETs `https://groups.google.com/g/tartey_mashma/search?q=דקל+בנו` with a real browser User-Agent
2. Saves the response HTML and inspects it
3. Parses with BeautifulSoup to find post titles and links
4. Fetches one post page and locates the PNG attachment link
5. Downloads the PNG and confirms it is a valid crossword image

**Key unknowns being tested:**
- Does Google serve meaningful HTML to a headless `requests` call, or a JavaScript shell?
- Is the PNG download URL accessible without login cookies?

| Outcome | Decision |
|---|---|
| PNG downloaded successfully, valid crossword | ✅ GO — proceed to Step 1 |
| Google returns JS-only shell | ⚠️ Evaluate `playwright` on Render (heavy: ~150 MB RAM on a 512 MB free tier) |
| PNG requires Google login | ❌ STOP — attachment is not truly public; reconsider approach |

**This step must be completed before any production code is written.**

---

### Step 1 — Storage Infrastructure (Supabase)

**What:** Provision Supabase as the external storage layer (free tier: 500 MB Postgres, 1 GB storage, 2 GB bandwidth — covers years of weekly puzzles at ~300 KB/PNG).

**Why Supabase over alternatives:**
- Render free tier has no persistent filesystem
- Supabase covers both image files (Storage) and metadata (Postgres) in one service
- Public bucket URLs are permanent — no signed URL complexity
- Single `supabase-py` pip install; simple Python client

**Supabase `puzzles` table schema:**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `google_group_post_id` | text unique | Deduplication key |
| `post_url` | text | Link to original post |
| `title` | text | Post title |
| `published_at` | timestamptz | Post date |
| `day_of_week` | text | "monday" or "wednesday" |
| `image_storage_path` | text | Supabase Storage path |
| `image_public_url` | text | Permanent public URL |
| `processed_data` | jsonb | Full `{grid, clues}` object (processed once at scrape time) |
| `processing_status` | text | "pending" / "done" / "error" |
| `created_at` | timestamptz | Auto |

**Supabase Storage bucket:** Public read, service-key-only write.

**New Render environment variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Files modified:**
- `backend/requirements.txt` — add `supabase`, `requests`, `beautifulsoup4`, `lxml`, `apscheduler`

---

### Step 2 — Backend Scraper Service

**New file: `backend/services/scraper.py`**

```
fetch_new_puzzles()
  → search_google_group()           # GET search URL, parse HTML, return [{post_id, url, title, date}]
  → for each post not already in DB:
      download_png_attachment()     # fetch post page, extract PNG URL, download bytes
      upload_to_supabase_storage()  # returns storage_path + public_url
      process_image()               # reuse existing service — returns {grid, clues}
      insert_puzzle_record()        # write to Supabase puzzles table
```

**Key details:**
- Idempotent: checks `google_group_post_id` before fetching — safe to run repeatedly
- Error-isolated: one bad post logs an error and continues; never aborts the full run
- Processing happens once at scrape time; `processed_data` is stored in Supabase so the frontend never re-processes

**Files created:** `backend/services/scraper.py`
**Files modified:** `backend/requirements.txt`

---

### Step 3 — New Backend API Endpoints

**New file: `backend/routes/archive.py`** (Flask Blueprint)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/puzzles` | List all puzzles ordered by `published_at` DESC. Returns lightweight fields only (`id`, `title`, `published_at`, `day_of_week`, `image_public_url`) — no grid data |
| `GET` | `/api/puzzles/<id>` | Full puzzle data including `processed_data` (`{grid, clues}`). Called when user opens a puzzle |
| `POST` | `/api/puzzles/sync` | Trigger a scraper run. Rate-limited to once per 5 minutes (checked via a `config` table in Supabase). Returns `{status, new_count}` |

**Notes:**
- The existing `POST /api/process` endpoint is untouched — Stage 1 manual upload is preserved
- Sync endpoint uses a module-level lock to prevent concurrent runs on the same worker
- Sync endpoint is unauthenticated (app is not secret) but rate-limited

**Files created:** `backend/routes/archive.py`
**Files modified:** `backend/app.py` (register Blueprint)

---

### Step 4 — Scheduled Sync (APScheduler)

**What:** `APScheduler` `BackgroundScheduler` initialised at Flask startup; runs `fetch_new_puzzles()` every Monday and Wednesday at 09:00 Israel time.

**Cold-start mitigation:** When Flask starts, immediately run a background-thread catch-up check. This handles posts missed while Render was sleeping.

**Note:** If Gunicorn is ever configured with multiple workers, each would start its own scheduler causing duplicate runs. Current config uses 1 worker — document this constraint.

**Files modified:** `backend/app.py`

---

### Step 5 — Per-Puzzle Progress Storage (Frontend)

**What:** Extend localStorage to support multiple puzzles.

**New localStorage keys:**
- `crossword_archive_meta` — cached puzzle list `{version: 2, fetchedAt, puzzles: [...]}`. Shown immediately on load while sync runs in background.
- `crossword_progress_{puzzle_id}` — per-puzzle letters map `{version: 2, puzzleId, letters: {}}`. Only the `letters` map is stored locally; full grid/clues are re-fetched from Supabase (they are immutable after processing).
- `crossword_puzzle` — Stage 1 key, left untouched for manual-upload workflow.

**Why not IndexedDB?** The `letters` map for a 9×9 grid is ~200 bytes. IndexedDB adds async complexity with no practical benefit at this scale.

**Files created:**
- `frontend/src/hooks/usePuzzleProgress.js` — per-puzzle localStorage wrapper
- `frontend/src/hooks/useArchive.js` — archive list state + sync trigger

---

### Step 6 — Archive Screen (Frontend)

**New file: `frontend/src/components/ArchiveScreen.js`**

**Design:**
- Puzzle cards, newest first
- Each card: Hebrew date (via `Intl.DateTimeFormat('he-IL', ...)`), title, progress indicator (% cells filled from saved `letters`)
- Tapping a card: fetches `GET /api/puzzles/{id}`, loads `processed_data` + saved `letters`, opens `SolverScreen`
- "רענן" (refresh) button calls `POST /api/puzzles/sync` then re-fetches list
- While sync is in background: non-blocking "בודק עדכונים..." spinner at top (cached list shown immediately)
- "העלה תשבץ ידנית" button at bottom navigates to existing `UploadScreen`
- RTL layout, Hebrew, mobile-first cards

**Cold-start UX:** Cached list shown immediately from `crossword_archive_meta`. Sync failure (e.g. Render still waking up) shows a subtle retry prompt — never blocks the user.

**Files created:**
- `frontend/src/components/ArchiveScreen.js`
- `frontend/src/components/ArchiveScreen.css`

---

### Step 7 — App Router Changes

**New screen flow:**
```
App opens → ArchiveScreen (new default)
    ↓ tap puzzle            ↓ tap "upload manually"
  SolverScreen            UploadScreen → ProcessingScreen → SolverScreen
    ↓ "back"
  ArchiveScreen
```

**Changes:**
- `App.js`: default screen changes from `'upload'` to `'archive'`; add `archive` case to screen switch
- `SolverScreen.js`: replace "העלה תשבץ חדש" with two buttons — "חזור לארכיון" (back to archive) and "העלה ידנית" (manual upload)
- `apiClient.js`: add `fetchPuzzleList()`, `fetchPuzzle(id)`, `triggerSync()`
- Stage 1 auto-resume: if `crossword_puzzle` (old key) exists in localStorage, show a "המשך תשבץ קודם" resume prompt in the ArchiveScreen header

**Files modified:**
- `frontend/src/App.js`
- `frontend/src/components/SolverScreen.js`
- `frontend/src/utils/apiClient.js`

---

### Step 8 — Integration Testing and Deploy

**Checklist:**
- Render env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Supabase RLS: public SELECT on `puzzles`, service-key-only INSERT/UPDATE
- End-to-end: trigger `/api/puzzles/sync` → puzzle appears in list → open it → solve cells → reload → progress restored
- Stage 1 regression: upload a custom image → still processes correctly → lands in SolverScreen

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Google returns JS-only HTML to `requests` | High | Step 0 gates on this; fallback is `playwright` subprocess |
| PNG attachment requires Google login | High | Step 0 gates on this; no known workaround if true |
| `playwright` exceeds Render free tier RAM (512 MB) | Medium | Run as one-shot subprocess; consider paid Render tier |
| APScheduler + multi-worker Gunicorn → duplicate runs | Low | Document 1-worker constraint; add DB-level lock if ever scaled |
| Supabase free tier pauses after inactivity | Low | Test reconnection; add retry logic in `supabase-py` client calls |

---

## New Files Summary

### Backend
| File | Status |
|---|---|
| `backend/services/scraper.py` | New |
| `backend/routes/archive.py` | New |
| `backend/app.py` | Modified |
| `backend/requirements.txt` | Modified |

### Frontend
| File | Status |
|---|---|
| `frontend/src/components/ArchiveScreen.js` | New |
| `frontend/src/components/ArchiveScreen.css` | New |
| `frontend/src/hooks/useArchive.js` | New |
| `frontend/src/hooks/usePuzzleProgress.js` | New |
| `frontend/src/App.js` | Modified |
| `frontend/src/components/SolverScreen.js` | Modified |
| `frontend/src/utils/apiClient.js` | Modified |
