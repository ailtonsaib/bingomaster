import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bomb, Flag, RefreshCw, Clock, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BOARD_SIZES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 12, mines: 25 },
  hard: { rows: 16, cols: 14, mines: 40 },
};

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
  const [difficulty, setDifficulty] = useState("easy");
  const [board, setBoard] = useState([]);
  const [status, setStatus] = useState("menu"); // menu | playing | won | lost
  const [flagsLeft, setFlagsLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [firstClick, setFirstClick] = useState(true);

  const config = BOARD_SIZES[difficulty];

  // Timer
  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Load best time
  useEffect(() => {
    const saved = localStorage.getItem(`ms_best_${difficulty}`);
    if (saved) setBestTime(parseInt(saved, 10));
  }, [difficulty]);

  const startGame = useCallback((diff) => {
    const cfg = BOARD_SIZES[diff];
    setDifficulty(diff);
    setBoard([]);
    setFlagsLeft(cfg.mines);
    setElapsed(0);
    setFirstClick(true);
    setStatus("playing");
  }, []);

  const revealCell = (r, c) => {
    if (status !== "playing") return;
    if (board.length === 0) return;
    if (board[r][c].revealed || board[r][c].flagged) return;

    let newBoard;
    if (firstClick) {
      newBoard = generateBoard(config.rows, config.cols, config.mines, r, c);
      setFirstClick(false);
    } else {
      newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    }

    // Flood fill
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

    // Check lose
    if (newBoard[r][c].mine) {
      // Reveal all mines
      for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++) {
          if (newBoard[i][j].mine) newBoard[i][j].revealed = true;
        }
      }
      setBoard([...newBoard]);
      setStatus("lost");
      return;
    }

    // Check win
    let unrevealed = 0;
    for (let i = 0; i < config.rows; i++) {
      for (let j = 0; j < config.cols; j++) {
        if (!newBoard[i][j].revealed && !newBoard[i][j].mine) unrevealed++;
      }
    }
    if (unrevealed === 0) {
      setStatus("won");
      const finalTime = elapsed;
      const saved = localStorage.getItem(`ms_best_${difficulty}`);
      if (!saved || finalTime < parseInt(saved, 10)) {
        localStorage.setItem(`ms_best_${difficulty}`, String(finalTime));
        setBestTime(finalTime);
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
    setFlagsLeft((prev) => newBoard[r][c].flagged ? prev - 1 : prev + 1);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const cellSize = difficulty === "hard" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1a2e] to-[#162d50] flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-3xl px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate("/jogos")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <span className="text-sm font-bold font-display text-white tracking-tight">Campo Minado</span>
        <div className="w-16" />
      </header>

      {/* Menu */}
      {status === "menu" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <Bomb className="w-16 h-16 text-red-400 mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Campo Minado</h1>
          <p className="text-white/60 text-sm mb-8 text-center max-w-xs">
            Use lógica e estratégia para revelar todas as células seguras sem pisar em uma mina!
          </p>
          <div className="space-y-3 w-full max-w-xs">
            {Object.entries(BOARD_SIZES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => startGame(key)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 text-left transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold capitalize">{key === "easy" ? "Fácil" : key === "medium" ? "Médio" : "Difícil"}</p>
                    <p className="text-white/50 text-xs">{cfg.rows}×{cfg.cols} • {cfg.mines} minas</p>
                  </div>
                  {localStorage.getItem(`ms_best_${key}`) && (
                    <div className="flex items-center gap-1 text-yellow-400 text-xs">
                      <Trophy className="w-3 h-3" /> {formatTime(parseInt(localStorage.getItem(`ms_best_${key}`), 10))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="text-white/40 text-xs mt-8 text-center">
            Toque para revelar • Toque e segure (ou clique direito) para marcar bandeira
          </p>
        </div>
      )}

      {/* Game */}
      {status !== "menu" && (
        <div className="flex flex-col items-center px-4 pb-12">
          {/* HUD */}
          <div className="flex items-center gap-4 mb-4 bg-white/10 rounded-xl px-4 py-2 border border-white/20">
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
            <button onClick={() => startGame(difficulty)} className="text-white/70 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Status banner */}
          {status === "won" && (
            <div className="mb-4 bg-green-500/20 border border-green-400/30 rounded-xl px-6 py-3 text-center">
              <p className="text-green-300 font-bold text-lg">🎉 Você venceu!</p>
              <p className="text-white/60 text-xs mt-1">Tempo: {formatTime(elapsed)} {bestTime === elapsed && "(Novo recorde!)"}</p>
            </div>
          )}
          {status === "lost" && (
            <div className="mb-4 bg-red-500/20 border border-red-400/30 rounded-xl px-6 py-3 text-center">
              <p className="text-red-300 font-bold text-lg">💥 Boom! Você perdeu.</p>
            </div>
          )}

          {/* Board */}
          <div className="bg-white/5 rounded-2xl p-2 border border-white/10 overflow-auto max-w-full">
            <div
              className="grid gap-0.5 select-none"
              style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
            >
              {board.length > 0 && board.map((row, r) =>
                row.map((cell, c) => (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => revealCell(r, c)}
                    onContextMenu={(e) => toggleFlag(e, r, c)}
                    onTouchStart={(e) => {
                      // Long press for flag on mobile
                      const timer = setTimeout(() => toggleFlag(e, r, c), 400);
                      const cancel = () => clearTimeout(timer);
                      e.currentTarget.addEventListener("touchend", cancel, { once: true });
                      e.currentTarget.addEventListener("touchmove", cancel, { once: true });
                    }}
                    className={`${cellSize} rounded flex items-center justify-center font-bold transition-colors ${
                      cell.revealed
                        ? cell.mine
                          ? "bg-red-500"
                          : "bg-white/90"
                        : "bg-white/15 hover:bg-white/25 active:bg-white/30"
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

          {/* Action buttons */}
          {(status === "won" || status === "lost") && (
            <div className="flex gap-2 mt-4">
              <Button onClick={() => startGame(difficulty)} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 px-5">
                <RefreshCw className="w-4 h-4 mr-1" /> Jogar de novo
              </Button>
              <Button variant="outline" onClick={() => navigate("/jogos")} className="rounded-xl h-10 border-white/20 text-white hover:bg-white/10">
                Sair
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-white/30 text-xs mt-auto mb-8 text-center px-4">
        © {new Date().getFullYear()} SoftPremier — Campo Minado
      </p>
    </div>
  );
}