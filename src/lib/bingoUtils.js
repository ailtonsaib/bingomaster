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

// Draw a random number not yet drawn
export function drawNumber(drawnNumbers, maxNumber = 75) {
  const available = [];
  for (let i = 1; i <= maxNumber; i++) {
    if (!drawnNumbers.includes(i)) available.push(i);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}