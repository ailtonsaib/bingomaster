import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bomb, Flag, RefreshCw, Clock, Trophy, Lock, ChevronRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameAccess } from "@/hooks/useGameAccess";
import LevelGate from "@/components/games/LevelGate";

const LEVELS = [
  { rows: 8, cols: 8, mines: 8 },
  { rows: 9, cols: 9, mines: 10 },
  { rows: 9, cols: 9, mines: 12 },
  { rows: 10, cols: 10, mines: 14 },
  { rows: 10, cols: 10, mines: 16 },
  { rows: 11, cols: 11, mines: 18 },
  { rows: 11, cols: 11, mines: 20 },
  { rows: 12, cols: 12, mines: 22 },
  { rows: 12, cols: 12, mines: 25 },
  { rows: 13, cols: 13, mines: 28 },
  { rows: 14, cols: 14, mines: 32 },
  { rows: 14, cols: 14, mines: 36 },
  { rows: 15, cols: 15, mines: 40 },
  { rows: 16, cols: 16, mines: 45 },
  { rows: 16, cols: 16, mines: 50 },
];

function generateBoard(rows, cols, mines, safeR, safeC) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    board.push([]);
    for (let c = 0; c < cols; c++) {
      board[r].push({ mine: false, revealed: false, flagged: false, count: 0 });
    }
  }
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (board[r][c].mine) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[r][c].count = count;
    }
  }
  return board;
}

const NUMBER_COLORS = ["", "text-blue-600", "text-green-600", "text-red-500", "text-purple-700", "text-orange-600", "text-teal-600", "text-pink-600", "text-gray-700"];

export default function MineSweeper() {
  const navigate = useNavigate();
  const { deviceCode, isPremium, price, freeLevels, loading, requestUnlock } = useGameAccess("campo-minado");
  const [screen, setScreen] = useState("menu");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(() => parseInt(localStorage.getItem("ms_maxlevel") || "1", 10));
  const [board, setBoard] = useState([]);
  const [status, setStatus] = useState("playing");
  const [flagsLeft, setFlagsLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  const config = LEVELS[currentLevel - 1] || LEVELS[0];

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const startLevel = useCallback((level) => {
    const cfg = LEVELS[level - 1] || LEVELS[0];
    setCurrentLevel(level);
    setBoard([]);
    setFlagsLeft(cfg.mines);
    setElapsed(0);
    setFirstClick(true);
    setStatus("playing");
    setScreen("playing");
  }, []);

  const revealCell = (r, c) => {
    if (status !== "playing" || board.length === 0) return;
    if (board[r][c].revealed || board[r][c].flagged) return;

    let newBoard;
    if (firstClick) {
      newBoard = generateBoard(config.rows, config.cols, config.mines, r, c);
      setFirstClick(false);
    } else {
      newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    }

    const stack = [[r, c]];
    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      if (cr < 0 || cr >= config.rows || cc < 0 || cc >= config.cols) continue;
      const cell = newBoard[cr][cc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.count === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            stack.push([cr + dr, cc + dc]);
          }
        }
      }
    }
    setBoard(newBoard);

    if (newBoard[r][c].mine) {
      for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++) {
          if (newBoard[i][j].mine) newBoard[i][j].revealed = true;
        }
      }
      setBoard([...newBoard]);
      setStatus("lost");
      return;
    }

    let unrevealed = 0;
    for (let i = 0; i < config.rows; i++) {
      for (let j = 0; j < config.cols; j++) {
        if (!newBoard[i][j].revealed && !newBoard[i][j].mine) unrevealed++;
      }
    }
    if (unrevealed === 0) {
      setStatus("won");
      if (currentLevel > maxLevel) {
        setMaxLevel(currentLevel);
        localStorage.setItem("ms_maxlevel", String(currentLevel));
      }
    }
  };

  const toggleFlag = (e, r, c) => {
    e.preventDefault();
    if (status !== "playing" || board.length === 0) return;
    if (board[r][c].revealed) return;
    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    newBoard[r][c].flagged = !newBoard[r][c].flagged;
    setBoard(newBoard);
    setFlagsLeft((prev) => (newBoard[r][c].flagged ? prev - 1 : prev + 1));
  };

  const nextLevel = () => {
    const next = currentLevel + 1;
    if (next > LEVELS.length) return;
    if (next > freeLevels && !isPremium) {
      setScreen("gate");
      return;
    }
    startLevel(next);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const cellSize = config.cols > 13 ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1a2e] to-[#162d50] flex flex-col items-center relative">
      <header className="w-full max-w-3xl px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate("/jogos")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <span className="text-sm font-bold font-display text-white tracking-tight">Campo Minado</span>
        <div className="w-16" />
      </header>

      {/* Menu */}
      {screen === "menu" && (
        <div className="flex-1 flex flex-col items-center px-6 pb-12 w-full max-w-md">
          <Bomb className="w-16 h-16 text-red-400 mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Campo Minado</h1>
          <p className="text-white/60 text-sm mb-6 text-center max-w-xs">
            Use lógica e estratégia para revelar todas as células seguras! Progrida pelos níveis e desafie-se.
          </p>

          {isPremium && (
            <div className="flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-4 py-1.5 mb-4">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-300 text-sm font-bold">Premium Ativo</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 w-full mb-6">
            {LEVELS.map((_, i) => {
              const lvl = i + 1;
              const isLocked = lvl > freeLevels && !isPremium;
              const isAvailable = lvl <= maxLevel || lvl === 1;
              return (
                <button
                  key={lvl}
                  disabled={isLocked || !isAvailable}
                  onClick={() => startLevel(lvl)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-lg transition-all ${
                    isLocked
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : isAvailable
                      ? lvl === maxLevel
                        ? "bg-purple-600 text-white hover:bg-purple-700 shadow-lg"
                        : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                  }`}
                >
                  {isLocked ? <Lock className="w-4 h-4" /> : lvl}
                  {lvl > freeLevels && !isLocked && (
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-white/40 text-xs text-center">
            Níveis 1-{freeLevels} gratuitos • Níveis {freeLevels + 1}+ premium
          </p>
          <p className="text-white/30 text-xs mt-2 text-center">
            Toque para revelar • Toque e segure para bandeira
          </p>
        </div>
      )}

      {/* Game */}
      {screen === "playing" && (
        <div className="flex flex-col items-center px-4 pb-12 w-full">
          <div className="flex items-center gap-4 mb-4 bg-white/10 rounded-xl px-4 py-2 border border-white/20">
            <span className="text-white font-bold text-sm">Nível {currentLevel}</span>
            {currentLevel > freeLevels && (
              <span className="flex items-center gap-1 text-yellow-400 text-xs"><Star className="w-3 h-3 fill-yellow-400" /> Premium</span>
            )}
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-1.5 text-white">
              <Flag className="w-4 h-4 text-red-400" />
              <span className="font-bold text-sm w-6 text-center">{flagsLeft}</span>
            </div>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-1.5 text-white">
              <Clock className="w-4 h-4 text-blue-300" />
              <span className="font-bold text-sm">{formatTime(elapsed)}</span>
            </div>
            <div className="w-px h-5 bg-white/20" />
            <button onClick={() => setScreen("menu")} className="text-white/70 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {status === "won" && (
            <div className="mb-4 bg-green-500/20 border border-green-400/30 rounded-xl px-6 py-3 text-center">
              <p className="text-green-300 font-bold text-lg">🎉 Nível {currentLevel} concluído!</p>
              <p className="text-white/60 text-xs mt-1">Tempo: {formatTime(elapsed)}</p>
              {currentLevel < LEVELS.length && (
                <Button onClick={nextLevel} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-9 px-5 mt-3">
                  Próximo Nível <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
          {status === "lost" && (
            <div className="mb-4 bg-red-500/20 border border-red-400/30 rounded-xl px-6 py-3 text-center">
              <p className="text-red-300 font-bold text-lg">💥 Boom! Você perdeu.</p>
            </div>
          )}

          <div className="bg-white/5 rounded-2xl p-2 border border-white/10 overflow-auto max-w-full">
            <div className="grid gap-0.5 select-none" style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}>
              {board.length > 0 &&
                board.map((row, r) =>
                  row.map((cell, c) => (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => revealCell(r, c)}
                      onContextMenu={(e) => toggleFlag(e, r, c)}
                      onTouchStart={(e) => {
                        const timer = setTimeout(() => toggleFlag(e, r, c), 400);
                        const cancel = () => clearTimeout(timer);
                        e.currentTarget.addEventListener("touchend", cancel, { once: true });
                        e.currentTarget.addEventListener("touchmove", cancel, { once: true });
                      }}
                      className={`${cellSize} rounded flex items-center justify-center font-bold transition-colors ${
                        cell.revealed ? (cell.mine ? "bg-red-500" : "bg-white/90") : "bg-white/15 hover:bg-white/25 active:bg-white/30"
                      }`}
                    >
                      {cell.revealed ? (
                        cell.mine ? (
                          <Bomb className="w-3.5 h-3.5 text-white" />
                        ) : cell.count > 0 ? (
                          <span className={NUMBER_COLORS[cell.count]}>{cell.count}</span>
                        ) : null
                      ) : cell.flagged ? (
                        <Flag className="w-3.5 h-3.5 text-red-400" />
                      ) : null}
                    </button>
                  ))
                )}
            </div>
          </div>

          {(status === "won" || status === "lost") && (
            <div className="flex gap-2 mt-4">
              {status === "lost" && <Button onClick={() => startLevel(currentLevel)} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 px-5">
                <RefreshCw className="w-4 h-4 mr-1" /> Tentar de novo
              </Button>}
              <Button variant="outline" onClick={() => setScreen("menu")} className="rounded-xl h-10 border-white/20 text-white hover:bg-white/10">
                Menu
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Gate */}
      {screen === "gate" && (
        <div className="flex-1 flex items-center justify-center w-full max-w-md px-6">
          <div className="w-full bg-white/10 rounded-2xl border border-white/20 relative min-h-[400px]">
            <LevelGate
              gameName="Campo Minado"
              price={price}
              freeLevels={freeLevels}
              deviceCode={deviceCode}
              onRequestUnlock={requestUnlock}
            />
          </div>
        </div>
      )}

      <p className="text-white/30 text-xs mt-auto mb-8 text-center px-4">
        © {new Date().getFullYear()} SoftPremier — Campo Minado
      </p>
    </div>
  );
}