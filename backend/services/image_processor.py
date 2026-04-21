import cv2
import numpy as np
from services.grid_extractor import extract_grid
from services.clue_extractor import extract_clues


def process_image(image_bytes: bytes) -> dict:
    """
    Orchestrate grid extraction (OpenCV) and clue extraction (Claude).
    Returns: { grid: {...}, clues: { across: [...], down: [...] } }
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Could not decode image')

    h, w = img.shape[:2]

    # Strip title bar: find bottom of the light-blue header
    y_start = _find_title_bar_bottom(img)

    content = img[y_start:h, 0:w]
    ch, cw = content.shape[:2]

    # Split: right ~38% → grid, left ~62% → clues
    # Using 62% instead of 67% to ensure the leftmost grid column isn't cut off
    split_x = int(cw * 0.62)
    grid_region = content[0:ch, split_x:cw]
    clue_region = content[0:ch, 0:split_x]

    grid = extract_grid(grid_region)
    clues = extract_clues(clue_region)

    return {'grid': grid, 'clues': clues}


def _find_title_bar_bottom(img: np.ndarray) -> int:
    """
    Detect the bottom edge of the header bar(s) at the very top of the image.
    Handles both light-blue (standard format) and dark-blue (alternative
    format such as ידיעות אחרונות) title/subtitle bars.

    Strategy: find the end of the first contiguous blue region starting from
    the top. This avoids being fooled by a second blue band lower in the image
    (e.g. a blue background in the clue area).

    Falls back to 10% of image height if no blue is detected.
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, w = img.shape[:2]

    # Blue family: hue ~90-130 (OpenCV 0-179), value floor 50 catches dark navy
    lower_blue = np.array([90, 60, 50])
    upper_blue = np.array([130, 255, 255])

    # Only scan the top 30% for header bars
    search_h = int(h * 0.30)
    mask = cv2.inRange(hsv[:search_h], lower_blue, upper_blue)
    row_sums = np.sum(mask, axis=1)
    threshold = w * 0.1 * 255  # at least 10% of row width is blue

    # Find the last blue row in the search zone (covers multiple stacked header bars)
    last_blue_row = 0
    for i, s in enumerate(row_sums):
        if s > threshold:
            last_blue_row = i

    if last_blue_row > 0:
        return last_blue_row + 1

    # Fallback: fixed 10%
    return int(h * 0.10)
