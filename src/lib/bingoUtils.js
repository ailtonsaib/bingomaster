// Generate a valid bingo grid (25 numbers)
// B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
export function generateBingoGrid() {
  const columns = [
    pickRandom(1, 15, 5),
    pickRandom(16, 30, 5),
    pickRandom(31, 45, 5),
    pickRandom(46, 60, 5),
    pickRandom(61, 75, 5),
  ];

  // Build grid row by row
  const grid = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      grid.push(columns[col][row]);
    }
  }
  // Center is free space (index 12)
  grid[12] = 0;
  return grid;
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

// Check if a grid has bingo (complete row, column, or diagonal)
// grid is 25 numbers in row-major order (index 12 = free space = 0)
export function checkBingo(grid, drawnSet) {
  if (!grid || grid.length !== 25) return false;

  const marked = grid.map((n, i) => i === 12 || n === 0 || drawnSet.has(n));

  // rows
  for (let r = 0; r < 5; r++) {
    if ([0,1,2,3,4].every(c => marked[r * 5 + c])) return true;
  }
  // columns
  for (let c = 0; c < 5; c++) {
    if ([0,1,2,3,4].every(r => marked[r * 5 + c])) return true;
  }
  // diagonals
  if ([0,6,12,18,24].every(i => marked[i])) return true;
  if ([4,8,12,16,20].every(i => marked[i])) return true;

  return false;
}

// Check all cards against drawn numbers and return winners for the next unaided prize
// Returns array of { card, prizeIndex, prizeName }
export function checkAllCardsForBingo(cards, drawnNumbers, prizes) {
  const drawnSet = new Set(drawnNumbers);
  const awardedCount = prizes.filter(p => p.awarded).length;
  const nextPrize = prizes[awardedCount];
  if (!nextPrize || nextPrize.awarded) return [];

  const winners = [];
  for (const card of cards) {
    if (card.is_winner) continue; // already won the next prize? skip
    const grid1Wins = card.grid_1 && checkBingo(card.grid_1, drawnSet);
    const grid2Wins = card.grid_2 && checkBingo(card.grid_2, drawnSet);
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