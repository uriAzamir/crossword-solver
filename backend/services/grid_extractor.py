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
    h, w = gray.shape

    # Otsu's thresholding adapts to the image's contrast automatically
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Trim whitespace to the left of the grid's outer border.
    # The grid border is a dense dark column (>40% of height dark).
    # Whitespace has almost no dark pixels, so we scan left→right for the first
    # column that crosses the threshold.
    col_dark = np.sum(binary == 0, axis=0)
    x_crop = 0
    for x in range(w):
        if col_dark[x] >= h * 0.4:
            x_crop = x
            break
    if x_crop > 0:
        gray = gray[:, x_crop:]
        binary = binary[:, x_crop:]
        grid_region = grid_region[:, x_crop:]
        w -= x_crop

    # Detect grid lines on the full region (no bounding box pre-crop)
    row_lines, col_lines = _detect_grid_lines(gray, binary, h, w)

    num_rows = len(row_lines) - 1
    num_cols = len(col_lines) - 1

    if not (5 <= num_rows <= 20 and 5 <= num_cols <= 20):
        raise ValueError(
            f'Unexpected grid dimensions: {num_rows}x{num_cols}. '
            'Expected between 5x5 and 20x20.'
        )

    # Classify each cell using the binary image directly
    cells = []
    for r in range(num_rows):
        row = []
        for c in range(num_cols):
            y0, y1 = row_lines[r], row_lines[r + 1]
            x0, x1 = col_lines[c], col_lines[c + 1]
            cell_img = binary[y0:y1, x0:x1]
            blocked = _is_blocked(cell_img)
            row.append({'blocked': blocked, 'number': None})
        cells.append(row)

    # Reverse columns for RTL: the image scans left→right, but Hebrew crosswords
    # display right→left (col index 0 = rightmost visual cell).
    # After reversal: cells[r][0] = rightmost image col = visual col 1 in Hebrew.
    cells = [row[::-1] for row in cells]

    # Number the cells (OCR or algorithmic).
    # Pass original col_lines so OCR can map reversed col indices back to image coords.
    cells = _assign_numbers(cells, grid_region, row_lines, col_lines, num_rows, num_cols)

    return {'rows': num_rows, 'cols': num_cols, 'cells': cells}


# ---------------------------------------------------------------------------
# Line detection
# ---------------------------------------------------------------------------

def _detect_grid_lines(gray, binary, h, w):
    """
    Detect horizontal and vertical grid lines.
    Primary: Hough line transform (works on the full region, ignores small features).
    Fallback: morphological line extraction.
    """
    row_lines, col_lines = _hough_lines(gray, h, w)

    if len(row_lines) - 1 >= 5 and len(col_lines) - 1 >= 5:
        row_lines = _regularize_lines(row_lines)
        col_lines = _regularize_lines(col_lines)
        return row_lines, col_lines

    print('[grid] Hough insufficient, falling back to morphological')
    row_lines, col_lines = _morphological_lines(binary, h, w)
    row_lines = _regularize_lines(row_lines)
    col_lines = _regularize_lines(col_lines)
    return row_lines, col_lines


def _hough_lines(gray, h, w):
    """
    Use HoughLinesP to detect grid lines.
    minLineLength filters out small clue numbers (10-15px) while keeping grid lines.
    """
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    min_dim = min(h, w)
    # A line must span at least 10% of the shorter dimension (~1 cell height).
    # Vertical lines get fragmented by blocked cells, so segments can be short.
    # 10% filters out clue numbers (10-15px) while catching single-cell segments.
    min_line_length = max(20, int(min_dim * 0.10))
    max_gap = max(5, int(min_dim * 0.03))
    threshold = max(15, int(min_line_length * 0.6))

    lines = cv2.HoughLinesP(
        edges, rho=1, theta=np.pi / 180,
        threshold=threshold,
        minLineLength=min_line_length,
        maxLineGap=max_gap
    )

    h_positions = []
    v_positions = []

    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            dx = abs(x2 - x1)
            dy = abs(y2 - y1)
            # Horizontal: much wider than tall
            if dx > 0 and dy < dx * 0.2:
                h_positions.append((y1 + y2) // 2)
            # Vertical: much taller than wide
            elif dy > 0 and dx < dy * 0.2:
                v_positions.append((x1 + x2) // 2)

    row_lines = _cluster_lines(sorted(h_positions), tolerance=8)
    col_lines = _cluster_lines(sorted(v_positions), tolerance=8)

    row_lines = _add_boundaries(row_lines, h)
    col_lines = _add_boundaries(col_lines, w)

    return row_lines, col_lines


def _morphological_lines(binary, h, w):
    """
    Use morphological OPEN to isolate lines that span most of the image.
    Thin lines (grid borders) survive; black cells and numbers are eroded away.
    """
    inv = cv2.bitwise_not(binary)

    # Kernel must span at least 50% of the image so only full-width lines survive
    h_kernel_len = max(20, int(w * 0.50))
    v_kernel_len = max(20, int(h * 0.50))

    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_len, 1))
    horizontal = cv2.morphologyEx(inv, cv2.MORPH_OPEN, h_kernel)
    row_proj = np.sum(horizontal, axis=1) / 255.0

    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_len))
    vertical = cv2.morphologyEx(inv, cv2.MORPH_OPEN, v_kernel)
    col_proj = np.sum(vertical, axis=0) / 255.0

    row_lines = _find_line_positions(row_proj, h, threshold_ratio=0.2)
    col_lines = _find_line_positions(col_proj, w, threshold_ratio=0.2)

    row_lines = _add_boundaries(row_lines, h)
    col_lines = _add_boundaries(col_lines, w)

    return row_lines, col_lines


def _regularize_lines(lines):
    """
    Post-process detected grid lines:
    1. Remove the leading line if its interval to the next line is <= 60% of the
       median interior interval (outer border edge detected twice, keep inner face).
    2. Same for the trailing line.
    3. Insert midpoint lines for any gap > 160% of median (missing interior lines).
    """
    if len(lines) < 4:
        return lines

    intervals = [lines[i + 1] - lines[i] for i in range(len(lines) - 1)]

    # Median from interior intervals (skip the first and last, which may be artifacts)
    interior = intervals[1:-1] if len(intervals) >= 3 else intervals
    median_interval = int(np.median(interior))

    if median_interval < 5:
        return lines

    small_threshold = int(median_interval * 0.6)
    large_threshold = int(median_interval * 1.6)

    result = list(lines)

    # Remove small leading interval (e.g. outer border edge + inner face both detected)
    if (result[1] - result[0]) <= small_threshold:
        result = result[1:]

    # Remove small trailing interval
    if len(result) >= 2 and (result[-1] - result[-2]) <= small_threshold:
        result = result[:-1]

    # Insert lines for large gaps (missed interior lines)
    final = [result[0]]
    for i in range(1, len(result)):
        prev = final[-1]
        curr = result[i]
        gap = curr - prev
        if gap > large_threshold:
            n_missing = round(gap / median_interval) - 1
            if n_missing > 0:
                step = gap / (n_missing + 1)
                for j in range(1, n_missing + 1):
                    final.append(int(prev + step * j))
        final.append(curr)

    return final


def _add_boundaries(lines, size, margin=10):
    if not lines or lines[0] > margin:
        lines = [0] + lines
    if not lines or lines[-1] < size - margin:
        lines = lines + [size]
    return lines


def _find_line_positions(projection, size, threshold_ratio=0.2):
    """Find midpoints of dark bands in a projection profile."""
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
            lines.append((line_start + i) // 2)

    if in_line:
        lines.append((line_start + size) // 2)

    return _cluster_lines(lines, tolerance=5)


def _cluster_lines(lines, tolerance=8):
    """Merge lines within tolerance pixels of each other (take median)."""
    if not lines:
        return []
    clusters = []
    current = [lines[0]]
    for line in lines[1:]:
        if line - current[-1] <= tolerance:
            current.append(line)
        else:
            clusters.append(int(np.median(current)))
            current = [line]
    clusters.append(int(np.median(current)))
    return clusters


# ---------------------------------------------------------------------------
# Cell classification
# ---------------------------------------------------------------------------

def _is_blocked(cell_img: np.ndarray) -> bool:
    """A cell is blocked (black) if its center 60% has mean pixel value < 80."""
    h, w = cell_img.shape
    margin_y = int(h * 0.2)
    margin_x = int(w * 0.2)
    if margin_y == 0 or margin_x == 0:
        return bool(np.mean(cell_img) < 80)
    center = cell_img[margin_y:h - margin_y, margin_x:w - margin_x]
    return bool(np.mean(center) < 80)


# ---------------------------------------------------------------------------
# Cell numbering
# ---------------------------------------------------------------------------

def _assign_numbers(cells, grid_color, row_lines, col_lines, num_rows, num_cols):
    if TESSERACT_AVAILABLE:
        try:
            return _ocr_numbers(cells, grid_color, row_lines, col_lines, num_rows, num_cols)
        except Exception:
            pass
    return _algorithmic_numbers(cells, num_rows, num_cols)


def _ocr_numbers(cells, grid_color, row_lines, col_lines, num_rows, num_cols):
    gray = cv2.cvtColor(grid_color, cv2.COLOR_BGR2GRAY)
    result_cells = [row[:] for row in cells]

    for r in range(num_rows):
        for c in range(num_cols):
            if cells[r][c]['blocked']:
                continue
            y0, y1 = row_lines[r], row_lines[r + 1]
            # cells columns are reversed (RTL), so data col c = original image col (num_cols-1-c)
            orig_c = num_cols - 1 - c
            x0, x1 = col_lines[orig_c], col_lines[orig_c + 1]
            cell_h = y1 - y0

            num_region = gray[y0:y0 + int(cell_h * 0.35), x0:x1]
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
    result_cells = [[dict(cell) for cell in row] for row in cells]
    number = 1

    for r in range(num_rows):
        for c in range(num_cols):
            if result_cells[r][c]['blocked']:
                continue
            if _starts_across(result_cells, r, c, num_rows, num_cols) or \
               _starts_down(result_cells, r, c, num_rows, num_cols):
                result_cells[r][c]['number'] = number
                number += 1

    return result_cells


def _starts_across(cells, r, c, num_rows, num_cols):
    if c > 0 and not cells[r][c - 1]['blocked']:
        return False
    return c + 1 < num_cols and not cells[r][c + 1]['blocked']


def _starts_down(cells, r, c, num_rows, num_cols):
    if r > 0 and not cells[r - 1][c]['blocked']:
        return False
    return r + 1 < num_rows and not cells[r + 1][c]['blocked']
