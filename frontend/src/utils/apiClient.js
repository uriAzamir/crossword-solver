const BASE_URL = process.env.REACT_APP_API_URL || 'https://crossword-solver-97og.onrender.com/api';

async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // Server returned non-JSON (e.g. Render "spinning up" HTML page)
    if (response.status === 503 || text.includes('<!doctype') || text.includes('<!DOCTYPE')) {
      throw new Error('השרת מתעורר, המתן מספר שניות ונסה שוב');
    }
    throw new Error(`שגיאת שרת (${response.status})`);
  }
}

export async function processPuzzleImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  let response;
  try {
    response = await fetch(`${BASE_URL}/process`, {
      method: 'POST',
      body: formData,
    });
  } catch (networkErr) {
    throw new Error('לא ניתן להתחבר לשרת. בדוק חיבור לאינטרנט ונסה שוב.');
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(data.message || `שגיאת שרת (${response.status})`);
  }

  return data;
}

export async function checkHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return parseResponse(response);
  } catch {
    return { status: 'unreachable' };
  }
}

export async function fetchPuzzleList() {
  let response;
  try {
    response = await fetch(`${BASE_URL}/puzzles`);
  } catch {
    throw new Error('לא ניתן להתחבר לשרת');
  }
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data.message || `שגיאת שרת (${response.status})`);
  return data;
}

export async function fetchPuzzle(id) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/puzzles/${id}`);
  } catch {
    throw new Error('לא ניתן להתחבר לשרת');
  }
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data.message || `שגיאת שרת (${response.status})`);
  return data;
}

export async function updatePuzzleClues(id, clues) {
  await fetch(`${BASE_URL}/puzzles/${id}/clues`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clues }),
  });
}

export async function createUser(username) {
  const response = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await parseResponse(response);
  if (!response.ok) throw Object.assign(new Error(data.error || 'שגיאת שרת'), { status: response.status });
  return data;
}

export async function getUserByName(username) {
  const response = await fetch(`${BASE_URL}/users/by-name/${encodeURIComponent(username)}`);
  const data = await parseResponse(response);
  if (!response.ok) throw Object.assign(new Error(data.error || 'שגיאת שרת'), { status: response.status });
  return data;
}

export async function fetchUserProgress(userId) {
  const response = await fetch(`${BASE_URL}/users/${userId}/progress`);
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data.error || 'שגיאת שרת');
  return data;
}

export async function saveUserProgress(userId, puzzleId, letters) {
  await fetch(`${BASE_URL}/users/${userId}/progress/${puzzleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ letters }),
  });
}

export async function bulkImportProgress(userId, entries) {
  await fetch(`${BASE_URL}/users/${userId}/progress/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  });
}

export async function triggerSync() {
  try {
    await fetch(`${BASE_URL}/puzzles/sync`, { method: 'POST' });
  } catch {
    // Sync failures are non-fatal — server may be waking up
  }
}
