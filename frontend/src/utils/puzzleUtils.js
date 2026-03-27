/**
 * Get all cells belonging to the word at a given position/direction.
 * In RTL Hebrew layout:
 *   - "across" moves left visually = increasing col index in array
 *   - "down" moves downward = increasing row index
 *
 * cells[row][0] is the RIGHTMOST column visually.
 */

export function getWordCells(grid, row, col, direction) {
  const { cells, rows, cols } = grid;
  const wordCells = [];

  if (direction === 'across') {
    // Find leftmost cell of this word (lowest col index = rightmost visually)
    let start = col;
    while (start > 0 && !cells[row][start - 1].blocked) {
      start--;
    }
    // Collect rightward in array (leftward visually)
    let c = start;
    while (c < cols && !cells[row][c].blocked) {
      wordCells.push([row, c]);
      c++;
    }
  } else {
    // down
    let start = row;
    while (start > 0 && !cells[start - 1][col].blocked) {
      start--;
    }
    let r = start;
    while (r < rows && !cells[r][col].blocked) {
      wordCells.push([r, col]);
      r++;
    }
  }

  return wordCells;
}

export function getWordAtCell(grid, row, col, direction, clues) {
  const wordCells = getWordCells(grid, row, col, direction);
  if (wordCells.length < 2) return null;

  // Find the numbered cell (first cell of the word)
  const [startRow, startCol] = wordCells[0];
  const number = grid.cells[startRow][startCol].number;
  if (!number) return null;

  const clueList = direction === 'across' ? clues.across : clues.down;
  const clue = clueList.find(c => c.number === number);

  return {
    direction,
    number,
    cells: wordCells,
    clueText: clue ? clue.text : '',
    length: clue ? clue.length : '',
  };
}

export function getNextCell(grid, row, col, direction) {
  const { cells, rows, cols } = grid;

  if (direction === 'across') {
    // Move left visually = increase col in array
    let next = col + 1;
    while (next < cols) {
      if (!cells[row][next].blocked) return [row, next];
      next++;
    }
    return null;
  } else {
    let next = row + 1;
    while (next < rows) {
      if (!cells[next][col].blocked) return [next, col];
      next++;
    }
    return null;
  }
}

export function getPrevCell(grid, row, col, direction) {
  const { cells } = grid;

  if (direction === 'across') {
    // Move right visually = decrease col in array
    let prev = col - 1;
    while (prev >= 0) {
      if (!cells[row][prev].blocked) return [row, prev];
      prev--;
    }
    return null;
  } else {
    let prev = row - 1;
    while (prev >= 0) {
      if (!cells[prev][col].blocked) return [prev, col];
      prev--;
    }
    return null;
  }
}

export function canGoDown(grid, row, col) {
  const wordCells = getWordCells(grid, row, col, 'down');
  return wordCells.length >= 2;
}

export function canGoAcross(grid, row, col) {
  const wordCells = getWordCells(grid, row, col, 'across');
  return wordCells.length >= 2;
}
