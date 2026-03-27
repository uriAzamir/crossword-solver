import cv2
import numpy as np

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


def extract_grid(grid_region: np.ndarray) -> dict:
    """
    Extract grid structure from the right ~33% of the puzzle image.
    Returns: { rows, cols, cells: [[{ blocked, number }]] }
    """
    gray = cv2.cvtColor(grid_region, cv2.COLOR_BGR2GRAY)

    # Binarize
    _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)

    # Find grid bounding box
    x, y, gw, gh = _find_grid_bounds(binary)
    pure_grid = binary[y:y+gh, x:x+gw]
    pure_grid_color = grid_region[y:y+gh, x:x+gw]

    # Detect grid lines via projection profiles
    row_lines, col_lines = _detect_grid_lines(pure_grid)

    num_rows = len(row_lines) - 1
    num_cols = len(col_lines) - 1

    if not (5 <= num_rows <= 20 and 5 <= num_cols <= 20):
        raise ValueError(
            f'Unexpected grid dimensions: {num_rows}x{num_cols}. '
            'Expected between 5x5 and 20x20.'
        )

    # Classify each cell
    cells = []
    for r in range(num_rows):
        row = []
        for c in range(num_cols):
            y0, y1 = row_lines[r], row_lines[r+1]
            x0, x1 = col_lines[c], col_lines[c+1]
            cell_img = pure_grid[y0:y1, x0:x1]
            blocked = _is_blocked(cell_img)
            row.append({'blocked': blocked, 'number': None})
        cells.append(row)

    # Number the cells
    cells = _assign_numbers(cells, pure_grid_color, row_lines, col_lines, num_rows, num_cols)

    return {'rows': num_rows, 'cols': num_cols, 'cells': cells}


def _find_grid_bounds(binary: np.ndarray):
    """Find the bounding box of the largest rectangular contour (the grid border)."""
    inverted = cv2.bitwise_not(binary)
    contours, _ = cv2.findContours(inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        h, w = binary.shape
        return 0, 0, w, h

    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    return x, y, w, h


def _detect_grid_lines(binary: np.ndarray):
    """
    Detect horizontal and vertical grid lines using projection profiles.
    Returns sorted lists of row and column line positions.
    """
    h, w = binary.shape

    # Invert: black pixels become 255
    inv = cv2.bitwise_not(binary)

    # Row projection: sum of dark pixels in each row
    row_proj = np.sum(inv, axis=1) / 255.0
    col_proj = np.sum(inv, axis=0) / 255.0

    row_lines = _find_line_positions(row_proj, h, threshold_ratio=0.3)
    col_lines = _find_line_positions(col_proj, w, threshold_ratio=0.3)

    # Ensure we include image boundaries
    if not row_lines or row_lines[0] > 5:
        row_lines = [0] + row_lines
    if not row_lines or row_lines[-1] < h - 5:
        row_lines = row_lines + [h]

    if not col_lines or col_lines[0] > 5:
        col_lines = [0] + col_lines
    if not col_lines or col_lines[-1] < w - 5:
        col_lines = col_lines + [w]

    return row_lines, col_lines


def _find_line_positions(projection, size, threshold_ratio=0.3):
    """Find positions of dark lines from a projection profile."""
    max_val = max(projection) if max(projection) > 0 else 1
    threshold = max_val * threshold_ratio

    in_line = False
    line_start = 0
    lines = []

    for i, val in enumerate(projection):
        if val >= threshold and not in_line:
            in_line = True
            line_start = i
        elif val < threshold and in_line:
            in_line = False
            mid = (line_start + i) // 2
            lines.append(mid)

    if in_line:
        lines.append((line_start + size) // 2)

    # Cluster lines within 5px of each other (take median)
    lines = _cluster_lines(lines, tolerance=5)
    return sorted(lines)


def _cluster_lines(lines, tolerance=5):
    """Merge lines that are within tolerance pixels of each other."""
    if not lines:
        return []
    clusters = []
    current_cluster = [lines[0]]
    for line in lines[1:]:
        if line - current_cluster[-1] <= tolerance:
            current_cluster.append(line)
        else:
            clusters.append(int(np.median(current_cluster)))
            current_cluster = [line]
    clusters.append(int(np.median(current_cluster)))
    return clusters


def _is_blocked(cell_img: np.ndarray) -> bool:
    """A cell is blocked (black) if its center 60% has mean pixel value < 80."""
    h, w = cell_img.shape
    margin_y = int(h * 0.2)
    margin_x = int(w * 0.2)
    if margin_y == 0 or margin_x == 0:
        return np.mean(cell_img) < 80
    center = cell_img[margin_y:h-margin_y, margin_x:w-margin_x]
    return np.mean(center) < 80


def _assign_numbers(cells, grid_color, row_lines, col_lines, num_rows, num_cols):
    """
    Assign clue numbers to cells. Tries OCR first, falls back to algorithmic numbering.
    A cell gets a number if it starts an across word (≥2 cells) or a down word (≥2 cells).
    """
    if TESSERACT_AVAILABLE:
        try:
            return _ocr_numbers(cells, grid_color, row_lines, col_lines, num_rows, num_cols)
        except Exception:
            pass

    return _algorithmic_numbers(cells, num_rows, num_cols)


def _ocr_numbers(cells, grid_color, row_lines, col_lines, num_rows, num_cols):
    """Use pytesseract to read numbers from the top portion of each white cell."""
    gray = cv2.cvtColor(grid_color, cv2.COLOR_BGR2GRAY)
    result_cells = [row[:] for row in cells]

    for r in range(num_rows):
        for c in range(num_cols):
            if cells[r][c]['blocked']:
                continue
            y0, y1 = row_lines[r], row_lines[r+1]
            x0, x1 = col_lines[c], col_lines[c+1]
            cell_h = y1 - y0
            cell_w = x1 - x0

            # Top 30% of cell for number region
            num_region = gray[y0:y0+int(cell_h*0.35), x0:x1]
            # Upscale 4x
            upscaled = cv2.resize(num_region, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
            _, thresh = cv2.threshold(upscaled, 128, 255, cv2.THRESH_BINARY)

            text = pytesseract.image_to_string(
                thresh,
                config='--psm 8 -c tessedit_char_whitelist=0123456789'
            ).strip()

            if text.isdigit():
                result_cells[r][c] = {**cells[r][c], 'number': int(text)}

    return result_cells


def _algorithmic_numbers(cells, num_rows, num_cols):
    """
    Number cells that start an across or down word, scanning left-to-right, top-to-bottom.
    In RTL Hebrew layout, col 0 is the rightmost column, so across words start at the
    highest column index (rightmost = col 0 in array).
    """
    result_cells = [[dict(cell) for cell in row] for row in cells]
    number = 1

    for r in range(num_rows):
        for c in range(num_cols):
            if result_cells[r][c]['blocked']:
                continue

            starts_across = _starts_across(result_cells, r, c, num_rows, num_cols)
            starts_down = _starts_down(result_cells, r, c, num_rows, num_cols)

            if starts_across or starts_down:
                result_cells[r][c]['number'] = number
                number += 1

    return result_cells


def _starts_across(cells, r, c, num_rows, num_cols):
    """Cell starts an across word if it's at the right edge or preceded by a black cell,
    and the next cell to the left (c+1) is white."""
    # In RTL: col 0 is rightmost. Across goes right→left = increasing col index.
    # A word starts at low col index (right side) when preceded by black or edge.
    if c > 0 and not cells[r][c-1]['blocked']:
        return False
    # Must have at least one more white cell to the right in array (lower col = more right visually)
    # Actually across moves left visually = increasing col in array
    return c + 1 < num_cols and not cells[r][c+1]['blocked']


def _starts_down(cells, r, c, num_rows, num_cols):
    """Cell starts a down word if it's at the top edge or preceded by a black cell above,
    and the cell below is white."""
    if r > 0 and not cells[r-1][c]['blocked']:
        return False
    return r + 1 < num_rows and not cells[r+1][c]['blocked']
