const BASE_URL = process.env.REACT_APP_API_URL || 'https://crossword-solver-97og.onrender.com/api';

export async function processPuzzleImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${BASE_URL}/process`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to process image');
  }

  return data;
}

export async function checkHealth() {
  const response = await fetch(`${BASE_URL}/health`);
  return response.json();
}
