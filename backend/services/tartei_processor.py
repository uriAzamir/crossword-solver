"""
Processor for the "תרתי משמע" Friday crossword format.

Layout:
  - Orange header bar at the top (title is in the left half only)
  - Grid: left portion of the content area, always 11×11
  - Yellow decorative bar below the grid
  - מאוזן clues: to the RIGHT of the grid (from title_bottom down to image bottom)
  - מאונך clues: BELOW the grid and yellow bar (bottom portion of the image),
    arranged in multiple columns

Detection anchors:
  - title_bottom: last row in top 20% with >10% orange pixels (HSV [5-30, 100-255, 100-255])
  - yellow_top:   first row in the LEFT half with >30% yellow pixels (HSV [20-40, 100-255, 150-255])
  - grid_right:   last column (in 0..image_width range) with >2% orange pixels
                  (the orange-tinted right edge of the grid frame)
"""

import cv2
import numpy as np
import anthropic
import base64
import json
import re
import io
from PIL import Image

from services.grid_extractor import extract_grid


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def process_image_tartei(image_bytes: bytes) -> dict:
    """
    Process a תרתי משמע format puzzle image.
    Returns: { grid: {...}, clues: { across: [...], down: [...] } }
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Could not decode image')

    h, w = img.shape[:2]

    title_bottom, yellow_top, grid_right = _detect_boundaries(img)

    # Grid region: from title_bottom to yellow_top, left portion up to grid_right
    grid_region = img[title_bottom:yellow_top, 0:grid_right]

    # מאוזן (across) clues: to the RIGHT of the grid, from title_bottom to bottom
    across_region = img[title_bottom:h, grid_right:w]

    # מאונך (down) clues: below the yellow bar, full width (both halves)
    down_region = img[yellow_top:h, 0:w]

    grid = extract_grid(grid_region)
    clues = _extract_clues_tartei(across_region, down_region)

    return {'grid': grid, 'clues': clues}


# ---------------------------------------------------------------------------
# Boundary detection
# ---------------------------------------------------------------------------

def _detect_boundaries(img: np.ndarray) -> tuple[int, int, int]:
    """
    Returns (title_bottom, yellow_top, grid_right).
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, w = img.shape[:2]

    # --- title_bottom: last orange row in top 20% ---
    orange_lower = np.array([5, 100, 100])
    orange_upper = np.array([30, 255, 255])
    search_h = int(h * 0.20)
    orange_mask_top = cv2.inRange(hsv[:search_h], orange_lower, orange_upper)
    row_sums = np.sum(orange_mask_top, axis=1) / 255.0
    orange_threshold = w * 0.10
    title_bottom = int(h * 0.05)  # fallback
    for i, s in enumerate(row_sums):
        if s > orange_threshold:
            title_bottom = i + 1

    # --- yellow_top: first yellow row in left half, searched below title ---
    yellow_lower = np.array([20, 100, 150])
    yellow_upper = np.array([40, 255, 255])
    left_half = w // 2
    search_start = title_bottom
    yellow_mask = cv2.inRange(hsv[search_start:, :left_half], yellow_lower, yellow_upper)
    row_sums_y = np.sum(yellow_mask, axis=1) / 255.0
    yellow_threshold = left_half * 0.30
    yellow_top = int(h * 0.75)  # fallback
    for i, s in enumerate(row_sums_y):
        if s > yellow_threshold:
            yellow_top = search_start + i
            break

    # --- grid_right: last orange column in the left half (grid frame edge) ---
    orange_mask_full = cv2.inRange(hsv[title_bottom:yellow_top], orange_lower, orange_upper)
    col_sums = np.sum(orange_mask_full, axis=0) / 255.0
    grid_h = yellow_top - title_bottom
    col_threshold = grid_h * 0.02
    grid_right = left_half  # fallback: split at midpoint
    for x in range(left_half - 1, -1, -1):
        if col_sums[x] > col_threshold:
            grid_right = x + 1
            break

    return title_bottom, yellow_top, grid_right


# ---------------------------------------------------------------------------
# Clue extraction (Claude vision)
# ---------------------------------------------------------------------------

def _extract_clues_tartei(across_region: np.ndarray, down_region: np.ndarray) -> dict:
    """
    Send the מאוזן and מאונך regions to Claude and return structured clues.
    """
    across_b64 = _encode_image(across_region)
    down_b64 = _encode_image(down_region)
    client = anthropic.Anthropic()

    prompt = """These are two images from a Hebrew "תרתי משמע" crossword puzzle.
IMAGE 1: The מאוזן (across/horizontal) clues — arranged in a single column.
IMAGE 2: The מאונך (down/vertical) clues — arranged in multiple columns side by side.

Clue format rules:
1. Each clue starts with a number in blue text followed by a dot: "1."
2. Each clue ends with a semicolon ";".
3. The letter count is the LAST parenthetical before the ";". It contains ONLY digits and commas, e.g. "(5)" or "(3,4)".
4. "(מ)" appearing inside the clue text is a wordplay hint that is PART OF THE CLUE TEXT — do NOT treat it as the letter count.
5. Clues can span multiple lines. A new clue only starts when you see "N." after a ";".
6. A new clue can begin mid-line immediately after the previous clue's ";".
7. The clue TEXT is everything between "N." and the final "(digits);".

Extract ALL clues from both images and return ONLY valid JSON — no other text, no markdown:
{"across": [{"number": 1, "text": "...", "length": "5"}], "down": [{"number": 1, "text": "...", "length": "3"}]}"""

    response = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=2048,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {'type': 'base64', 'media_type': 'image/png', 'data': across_b64}
                },
                {
                    'type': 'image',
                    'source': {'type': 'base64', 'media_type': 'image/png', 'data': down_b64}
                },
                {'type': 'text', 'text': prompt}
            ]
        }]
    )

    raw = response.content[0].text.strip()
    clues = _parse_response(raw)

    if not _validate_clues(clues):
        retry_prompt = prompt + '\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object, starting with { and ending with }. Absolutely no other text.'
        response2 = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=2048,
            messages=[{
                'role': 'user',
                'content': [
                    {
                        'type': 'image',
                        'source': {'type': 'base64', 'media_type': 'image/png', 'data': across_b64}
                    },
                    {
                        'type': 'image',
                        'source': {'type': 'base64', 'media_type': 'image/png', 'data': down_b64}
                    },
                    {'type': 'text', 'text': retry_prompt}
                ]
            }]
        )
        raw = response2.content[0].text.strip()
        clues = _parse_response(raw)

    if not _validate_clues(clues):
        raise ValueError('Claude returned invalid clue structure after retry')

    return clues


# ---------------------------------------------------------------------------
# Helpers (duplicated from clue_extractor to keep this module self-contained)
# ---------------------------------------------------------------------------

def _encode_image(region: np.ndarray) -> str:
    rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buffer = io.BytesIO()
    pil_img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def _parse_response(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


def _validate_clues(clues: dict) -> bool:
    if not isinstance(clues, dict):
        return False
    if 'across' not in clues or 'down' not in clues:
        return False
    for direction in ('across', 'down'):
        if not isinstance(clues[direction], list):
            return False
        for item in clues[direction]:
            if not isinstance(item, dict):
                return False
            if 'number' not in item or 'text' not in item:
                return False
    return True
