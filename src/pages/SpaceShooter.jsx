import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket, Heart, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 36;
const BULLET_SIZE = 4;
const ENEMY_SIZE = 32;
const PLAYER_SPEED = 6;
const BULLET_SPEED = 10;
const ENEMY_SPEED = 1.5;
const FIRE_COOLDOWN = 250;

export default function SpaceShooter() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState("menu"); // menu | playing | gameover
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);

  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2 - PLAYER_SIZE / 2);
  const [bullets, setBullets] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [particles, setParticles] = useState([]);

  const keysRef = useRef({});
  const lastFireRef = useRef(0);
  const lastEnemySpawnRef = useRef(0);
  const rafRef = useRef(null);
  const runningRef = useRef(false);
  const playerXRef = useRef(playerX);
  const scoreRef = useRef(score);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem("ss_highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const resetGame = useCallback(() => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPlayerX(GAME_WIDTH / 2 - PLAYER_SIZE / 2);
    setBullets([]);
    setEnemies([]);
    setParticles([]);
    lastFireRef.current = 0;
    lastEnemySpawnRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setScreen("playing");
    runningRef.current = true;
  }, [resetGame]);

  // Refs to track latest values inside loop
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Keyboard controls
  useEffect(() => {
    if (screen !== "playing") return;
    const handleKeyDown = (e) => {
      keysRef.current[e.key] = true;
      if (["ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) e.preventDefault();
    };
    const handleKeyUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [screen]);

  // Fire a bullet
  const fireBullet = useCallback(() => {
    const now = performance.now();
    if (now - lastFireRef.current > FIRE_COOLDOWN) {
      lastFireRef.current = now;
      setBullets((prev) => [...prev, {
        x: playerXRef.current + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
        y: GAME_HEIGHT - PLAYER_SIZE - 10,
      }]);
    }
  }, []);

  // Game loop
  useEffect(() => {
    if (screen !== "playing" || !runningRef.current) return;

    const loop = (timestamp) => {
      if (!runningRef.current) return;

      // Move player
      setPlayerX((prev) => {
        let next = prev;
        if (keysRef.current["ArrowLeft"] || keysRef.current["a"]) next -= PLAYER_SPEED;
        if (keysRef.current["ArrowRight"] || keysRef.current["d"]) next += PLAYER_SPEED;
        return Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, next));
      });

      // Fire
      if (keysRef.current[" "] || keysRef.current["Space"]) {
        fireBullet();
      }

      // Spawn enemies
      const spawnInterval = Math.max(400, 1200 - level * 100);
      if (timestamp - lastEnemySpawnRef.current > spawnInterval) {
        lastEnemySpawnRef.current = timestamp;
        setEnemies((prev) => [...prev, {
          x: Math.random() * (GAME_WIDTH - ENEMY_SIZE),
          y: -ENEMY_SIZE,
          hp: level > 2 ? 2 : 1,
        }]);
      }

      // Move bullets
      setBullets((prev) => prev
        .map((b) => ({ ...b, y: b.y - BULLET_SPEED }))
        .filter((b) => b.y > -BULLET_SIZE)
      );

      // Move enemies + check player collision
      setEnemies((prevEnemies) => {
        const px = playerXRef.current;
        const py = GAME_HEIGHT - PLAYER_SIZE - 10;
        let collided = false;
        const surviving = [];
        for (const e of prevEnemies) {
          // check collision with player
          if (
            px < e.x + ENEMY_SIZE && px + PLAYER_SIZE > e.x &&
            py < e.y + ENEMY_SIZE && py + PLAYER_SIZE > e.y
          ) {
            collided = true;
            continue; // remove this enemy
          }
          // keep if still on screen
          if (e.y < GAME_HEIGHT) {
            surviving.push({ ...e, y: e.y + ENEMY_SPEED + level * 0.3 });
          }
        }
        if (collided) {
          setLives((prev) => {
            const nl = prev - 1;
            if (nl <= 0) {
              runningRef.current = false;
              setScreen("gameover");
              setHighScore((prevHs) => {
                const newHs = Math.max(prevHs, scoreRef.current);
                localStorage.setItem("ss_highscore", String(newHs));
                return newHs;
              });
            }
            return Math.max(0, nl);
          });
        }
        return surviving;
      });

      // Collision: bullets vs enemies
      setBullets((prevBullets) => {
        const remainingBullets = [];
        const hitEnemies = new Set();
        let hitCount = 0;

        for (const b of prevBullets) {
          let bulletHit = false;
          setEnemies((prevEnemies) => {
            for (let i = 0; i < prevEnemies.length; i++) {
              if (hitEnemies.has(i)) continue;
              const e = prevEnemies[i];
              if (
                b.x < e.x + ENEMY_SIZE && b.x + BULLET_SIZE > e.x &&
                b.y < e.y + ENEMY_SIZE && b.y + BULLET_SIZE > e.y
              ) {
                bulletHit = true;
                if (e.hp > 1) {
                  hitEnemies.add(i);
                  // We can't mutate here cleanly; simplified: remove enemy
                  hitCount++;
                  setParticles((prev) => [...prev, { x: e.x + ENEMY_SIZE / 2, y: e.y + ENEMY_SIZE / 2, life: 20 }]);
                } else {
                  hitEnemies.add(i);
                  hitCount++;
                  setParticles((prev) => [...prev, { x: e.x + ENEMY_SIZE / 2, y: e.y + ENEMY_SIZE / 2, life: 20 }]);
                }
                break;
              }
            }
            return prevEnemies;
          });
          if (!bulletHit) remainingBullets.push(b);
        }

        if (hitCount > 0) {
          setEnemies((prevEnemies) => prevEnemies.filter((_, i) => !hitEnemies.has(i)));
          setScore((prev) => {
            const ns = prev + hitCount * 10;
            setLevel(Math.floor(ns / 100) + 1);
            return ns;
          });
        }

        return remainingBullets;
      });

      // Update particles
      setParticles((prev) => prev
        .map((p) => ({ ...p, life: p.life - 1 }))
        .filter((p) => p.life > 0)
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, level, fireBullet]);

  // Touch controls
  const handleTouch = useCallback((e) => {
    if (screen !== "playing") return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    setPlayerX(Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, x - PLAYER_SIZE / 2)));
    fireBullet();
  }, [screen, fireBullet]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] to-[#1a1040] flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-md px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate("/jogos")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <span className="text-sm font-bold font-display text-white tracking-tight">Galaxy Blaster</span>
        <div className="w-16" />
      </header>

      {/* HUD */}
      {screen === "playing" && (
        <div className="w-full max-w-md px-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart key={i} className={`w-4 h-4 ${i < lives ? "text-red-500 fill-red-500" : "text-white/20"}`} />
            ))}
          </div>
          <span className="text-white font-bold text-sm">Pontos: {score}</span>
          <span className="text-white/60 text-xs flex items-center gap-1"><Zap className="w-3 h-3" /> Nv {level}</span>
        </div>
      )}

      {/* Game area */}
      <div
        className="relative bg-[#050714] border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT, maxWidth: "100vw" }}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
      >
        {/* Stars background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full"
              style={{
                width: Math.random() * 2 + 1,
                height: Math.random() * 2 + 1,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.6 + 0.2,
              }}
            />
          ))}
        </div>

        {/* Menu screen */}
        {screen === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Rocket className="w-16 h-16 text-purple-400 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Galaxy Blaster</h1>
            <p className="text-white/60 text-sm mb-1">Destrua os asteroides!</p>
            <p className="text-white/40 text-xs mb-6">Recorde: {highScore}</p>
            <Button onClick={startGame} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 px-8 text-lg font-bold">
              Jogar
            </Button>
            <div className="mt-6 text-white/40 text-xs space-y-1">
              <p>← → ou A/D para mover</p>
              <p>Espaço para atirar</p>
              <p>Touch: toque para mover e atirar</p>
            </div>
          </div>
        )}

        {/* Game over screen */}
        {screen === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black/60">
            <h2 className="text-2xl font-bold text-white mb-2">Game Over</h2>
            <p className="text-white/60 text-sm mb-1">Pontos: {score}</p>
            <p className="text-white/40 text-xs mb-6">Recorde: {highScore}</p>
            <div className="flex gap-2">
              <Button onClick={startGame} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11 px-6">
                Jogar de novo
              </Button>
              <Button variant="outline" onClick={() => navigate("/jogos")} className="rounded-xl h-11 border-white/20 text-white hover:bg-white/10">
                Sair
              </Button>
            </div>
          </div>
        )}

        {/* Player ship */}
        {screen === "playing" && (
          <div
            className="absolute transition-none"
            style={{ left: playerX, top: GAME_HEIGHT - PLAYER_SIZE - 10, width: PLAYER_SIZE, height: PLAYER_SIZE }}
          >
            <div className="w-full h-full flex items-center justify-center text-2xl">🚀</div>
          </div>
        )}

        {/* Bullets */}
        {screen === "playing" && bullets.map((b, i) => (
          <div
            key={`b-${i}`}
            className="absolute bg-yellow-300 rounded-full pointer-events-none"
            style={{
              left: b.x, top: b.y,
              width: BULLET_SIZE * 2, height: BULLET_SIZE * 2,
              boxShadow: "0 0 8px rgba(253, 224, 71, 0.8)",
            }}
          />
        ))}

        {/* Enemies */}
        {screen === "playing" && enemies.map((e, i) => (
          <div
            key={`e-${i}`}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{ left: e.x, top: e.y, width: ENEMY_SIZE, height: ENEMY_SIZE }}
          >
            <span className="text-2xl">{e.hp > 1 ? "☄️" : "🪨"}</span>
          </div>
        ))}

        {/* Explosion particles */}
        {particles.map((p, i) => (
          <div
            key={`p-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: p.x, top: p.y,
              width: p.life, height: p.life,
              background: `rgba(255, ${100 + p.life * 8}, 0, ${p.life / 20})`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>

      {/* Mobile fire button */}
      {screen === "playing" && (
        <div className="mt-4 md:hidden">
          <Button
            className="bg-purple-600 active:bg-purple-800 text-white rounded-full w-16 h-16 text-2xl"
            onTouchStart={(e) => { e.preventDefault(); fireBullet(); }}
            onClick={() => fireBullet()}
          >
            🔥
          </Button>
        </div>
      )}

      <p className="text-white/30 text-xs mt-4 mb-8 text-center px-4">
        © {new Date().getFullYear()} SoftPremier — Galaxy Blaster
      </p>
    </div>
  );
}