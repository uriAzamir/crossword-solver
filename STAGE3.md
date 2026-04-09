# Stage 3 — Multi-User Support (Plan)

## Goal

Allow multiple people to use the app independently, each with their own solving progress, without seeing each other's answers. Identity is based on a username only (no passwords) since the app is private and used by trusted friends.

Existing progress (stored in localStorage under the original unnamed session) will be migrated to a new user named "אורי".

---

## User Experience

### First Open (no user stored)

A login screen appears with three options:

- **כניסה עם שם משתמש קיים** — enter an existing username to resume progress
- **משתמש חדש** — pick a new username (must be unique)
- **כניסה כאורח** — use the app without an account; progress saved to this device only

Username is stored in localStorage after login. Returning users skip the login screen automatically.

### During Use

- Archive header shows "שלום, [username]" with a "החלף משתמש" link
- Each user's mini progress grids on puzzle cards reflect only their own progress

### Guest Mode

Progress works exactly as before Stage 3 — saved to localStorage on the current device only, not visible to other users.

---

## Database Schema (new tables in Supabase)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  letters JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, puzzle_id)
);
```

---

## Implementation Steps

### Step 1 — Supabase Tables

Run the SQL above in Supabase SQL editor. Set RLS to allow public SELECT/INSERT/UPDATE (app uses trust-based access, no auth tokens).

### Step 2 — Backend: `routes/users.py` (new)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Create user. Returns `409` if username taken. |
| `GET` | `/api/users/by-name/<username>` | Log in — look up user by name. `404` if not found. |
| `GET` | `/api/users/<user_id>/progress` | All progress for a user: `{puzzle_id: {letters}}` map. |
| `PUT` | `/api/users/<user_id>/progress/<puzzle_id>` | Upsert progress for one puzzle. |
| `POST` | `/api/users/<user_id>/progress/bulk` | Bulk import (migration only). |

### Step 3 — Backend: `app.py`

Register the new `users_bp` blueprint.

### Step 4 — Frontend: `hooks/useCurrentUser.js` (new)

Manages `crossword_user` localStorage key (`{id, username}`). Returns `currentUser`, `setCurrentUser`, `clearCurrentUser`.

### Step 5 — Frontend: `components/LoginScreen.js` + `.css` (new)

Three-button screen. Login and create flows show a text input. Guest skips straight to the archive. The create flow automatically migrates any existing `crossword_progress_*` localStorage keys to the new account (bulk import), then clears them locally.

### Step 6 — Frontend: `apiClient.js`

Add `createUser`, `getUserByName`, `fetchUserProgress`, `saveUserProgress`, `bulkImportProgress`.

### Step 7 — Frontend: `hooks/usePuzzleProgress.js`

Add async `loadProgressFromServer(userId, puzzleId)` and `saveProgressToServer(userId, puzzleId, letters)` alongside existing localStorage functions (guest path unchanged).

### Step 8 — Frontend: `App.js`

- Show `LoginScreen` when no `currentUser` in localStorage
- Thread `currentUser` to progress load/save (server for logged-in, localStorage for guest)
- Load all user progress once on archive open for mini grid display
- Add `handleLogout()` to return to login screen

### Step 9 — Frontend: `ArchiveScreen.js`

- Accept `allProgress` prop (`{puzzleId: letterCount}`) from App.js instead of reading localStorage inline
- Show username in header with "החלף משתמש" link

---

## Migration: Existing Progress → "אורי"

When creating a new user and localStorage contains `crossword_progress_*` keys:
1. Collect all entries: `[{puzzle_id, letters}]`
2. Show "מעביר התקדמות..." while bulk-uploading to the new account
3. Clear the migrated localStorage keys on success

This runs automatically during the "create user" flow — no manual steps needed.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| No passwords | App is for trusted friends; username alone is sufficient |
| Supabase for progress | Cross-device sync; consistent across browsers and devices |
| localStorage as identity store | Simple; avoids session tokens; fine for trust-based app |
| All progress loaded at archive open | Enables synchronous mini grid display without per-card async calls |
| Guest mode keeps localStorage | Zero regression for anyone who doesn't want an account |

---

## New Files Summary

| File | Status |
|---|---|
| `backend/routes/users.py` | New |
| `backend/app.py` | Modified (+1 line) |
| `frontend/src/hooks/useCurrentUser.js` | New |
| `frontend/src/components/LoginScreen.js` | New |
| `frontend/src/components/LoginScreen.css` | New |
| `frontend/src/utils/apiClient.js` | Modified (+5 functions) |
| `frontend/src/hooks/usePuzzleProgress.js` | Modified (+2 async functions) |
| `frontend/src/App.js` | Modified (login gate + userId threading) |
| `frontend/src/components/ArchiveScreen.js` | Modified (allProgress prop + username display) |
