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
