// Generate a valid bingo grid (20 cells, 4 rows x 5 cols, no free space)
// S: 1-15, O: 16-30, R: 31-45, T: 46-60, E: 61-75
export function generateBingoGrid() {
  const columns = [
    pickRandom(1, 15, 4),
    pickRandom(16, 30, 4),
    pickRandom(31, 45, 4),
    pickRandom(46, 60, 4),
    pickRandom(61, 75, 4),
  ];

  // Build grid row by row (4 rows x 5 cols = 20 cells)
  const grid = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      grid.push(columns[col][row]);
    }
  }
  return grid;
}

// Generate 3 distinct grids for one chance section
export function generateThreeGrids() {
  return [generateBingoGrid(), generateBingoGrid(), generateBingoGrid()];
}

function pickRandom(min, max, count) {
  const nums = [];
  for (let i = min; i <= max; i++) nums.push(i);
  // Shuffle
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums.slice(0, count).sort((a, b) => a - b);
}

// Check if a grid has bingo based on the selected draw type
// type: "horizontal" | "vertical" | "diagonal" | "full"
// Grid is 4 rows x 5 cols = 20 cells
export function checkBingo(grid, drawnSet, type = "horizontal") {
  if (!grid || grid.length !== 20) return false;

  const ROWS = 4;
  const COLS = 5;
  const marked = grid.map((n) => drawnSet.has(n));

  if (type === "horizontal" || type === "full") {
    for (let r = 0; r < ROWS; r++) {
      if ([0,1,2,3,4].every(c => marked[r * COLS + c])) {
        if (type === "horizontal") return true;
      }
    }
  }

  if (type === "vertical" || type === "full") {
    for (let c = 0; c < COLS; c++) {
      if ([0,1,2,3].every(r => marked[r * COLS + c])) {
        if (type === "vertical") return true;
      }
    }
  }

  if (type === "diagonal" || type === "full") {
    // Main diagonal: (0,0),(1,1),(2,2),(3,3) — 4 cells
    const diag1 = [0, 6, 12, 18].every(i => marked[i]);
    // Anti diagonal: (0,4),(1,3),(2,2),(3,1)
    const diag2 = [4, 8, 12, 16].every(i => marked[i]);
    if (diag1 || diag2) {
      if (type === "diagonal") return true;
    }
  }

  if (type === "full") {
    return marked.every(Boolean);
  }

  return false;
}

// Check all cards against drawn numbers and return winners for the next unaided prize
// Returns array of { card, prizeIndex, prizeName }
export function checkAllCardsForBingo(cards, drawnNumbers, prizes, drawType = "horizontal") {
  const drawnSet = new Set(drawnNumbers);
  const awardedCount = prizes.filter(p => p.awarded).length;
  const nextPrize = prizes[awardedCount];
  if (!nextPrize || nextPrize.awarded) return [];

  const winners = [];
  for (const card of cards) {
    if (card.is_winner) continue;
    const grid1Wins = card.grid_1 && checkBingo(card.grid_1, drawnSet, drawType);
    const grid2Wins = card.grid_2 && checkBingo(card.grid_2, drawnSet, drawType);
    if (grid1Wins || grid2Wins) {
      winners.push({ card, prizeIndex: awardedCount, prizeName: nextPrize.name });
    }
  }
  return winners;
}

// Draw a random number not yet drawn
export function drawNumber(drawnNumbers, maxNumber = 75) {
  const available = [];
  for (let i = 1; i <= maxNumber; i++) {
    if (!drawnNumbers.includes(i)) available.push(i);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}