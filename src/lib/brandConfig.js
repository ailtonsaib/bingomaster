export const BRAND_OPTIONS = ["BINGO", "SORTE", "AJUDA"];

// Cores por índice de coluna (0-4), independente da letra
export const COLUMN_BG = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-600",
];

export const COLUMN_GRADIENT = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-yellow-600",
  "from-rose-500 to-red-600",
];

export const COLUMN_SOFT = [
  "text-violet-300 border-violet-500/40 bg-violet-900/30",
  "text-blue-300 border-blue-500/40 bg-blue-900/30",
  "text-emerald-300 border-emerald-500/40 bg-emerald-900/30",
  "text-amber-300 border-amber-500/40 bg-amber-900/30",
  "text-rose-300 border-rose-500/40 bg-rose-900/30",
];

export function getBrandLetters(brandName) {
  return (brandName || "BINGO").toUpperCase().split("");
}

export function getColumnIndex(num) {
  return Math.min(4, Math.max(0, Math.ceil(num / 15) - 1));
}

export function getLetterForNumber(num, brandName) {
  return getBrandLetters(brandName)[getColumnIndex(num)] || "";
}