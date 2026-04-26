"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Pos = { x: number; y: number };
type GameState = "START" | "PLAYING" | "GAMEOVER" | "RECORD" | "LOCKED";

// ─── Constants ──────────────────────────────────────────
const GRID = 20;
const INITIAL_SPEED = 160;
const SPEED_INCREASE = 4;
const MIN_SPEED = 60;
const RECORD_TARGET = 200;
const MAX_PLAYS = 3;
const STAFF_PIN = "0000";
const LOGO_URL = "https://codewords-uploads.s3.amazonaws.com/runtime_v2/e2086eee7f3b4207935906a821fa5e1c8369b50d16a1450b9a9b72243da1cc95/oscologo.png";

const MONEY_EMOJIS = ["💵", "💰", "💲", "🪙", "💎"];
const COFFEE_HEAD = "☕";
const COFFEE_BODY = "🟤";

// ─── Helper: random grid position ───────────────────────
function randomPos(cols: number, rows: number): Pos {
  return {
    x: Math.floor(Math.random() * cols),
    y: Math.floor(Math.random() * rows),
  };
}

function randomMoney() {
  return MONEY_EMOJIS[Math.floor(Math.random() * MONEY_EMOJIS.length)];
}

// ─── Confetti component ─────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => {
    const colors = ["#FF006E", "#00FFFF", "#39FF14", "#FFE600", "#F97316", "#FF6B6B"];
    const emojis = ["☕", "💰", "🎉", "⭐", "💵", "🏆"];
    const isEmoji = Math.random() > 0.5;
    return (
      <div
        key={i}
        className="confetti"
        style={{
          left: `${Math.random() * 100}vw`,
          animationDuration: `${2 + Math.random() * 3}s`,
          animationDelay: `${Math.random() * 2}s`,
          fontSize: isEmoji ? "24px" : "0",
          width: isEmoji ? "auto" : "10px",
          height: isEmoji ? "auto" : "10px",
          backgroundColor: isEmoji ? "transparent" : colors[i % colors.length],
          borderRadius: isEmoji ? "0" : "50%",
        }}
      >
        {isEmoji ? emojis[i % emojis.length] : ""}
      </div>
    );
  });
  return <>{pieces}</>;
}

// ─── Main Game ──────────────────────────────────────────
export default function ColdBrewChase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("START");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [currentMoney, setCurrentMoney] = useState("💵");
  const [playsLeft, setPlaysLeft] = useState(MAX_PLAYS);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const playsLeftRef = useRef(MAX_PLAYS);

  // Game state refs (avoid stale closures)
  const snakeRef = useRef<Pos[]>([{ x: 5, y: 5 }]);
  const dirRef = useRef<Direction>("RIGHT");
  const nextDirRef = useRef<Direction>("RIGHT");
  const foodRef = useRef<Pos>({ x: 10, y: 10 });
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridInfoRef = useRef({ cols: 20, rows: 20, cellSize: 20 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // ─── Load high score ────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("osco-highscore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // ─── Calculate grid dimensions ──────────────────────
  const calculateGrid = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 32, 800);
    const maxH = Math.min(window.innerHeight - 200, 800);
    const size = Math.min(maxW, maxH);
    const cellSize = Math.floor(size / GRID);
    gridInfoRef.current = { cols: GRID, rows: GRID, cellSize };
    return { cols: GRID, rows: GRID, cellSize };
  }, []);

  // ─── Draw game ──────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, cellSize } = gridInfoRef.current;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    // Background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines (subtle)
    ctx.strokeStyle = "rgba(0, 255, 255, 0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, rows * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(cols * cellSize, y * cellSize);
      ctx.stroke();
    }

    // Food (money)
    const food = foodRef.current;
    ctx.font = `${cellSize - 4}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      currentMoney,
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2
    );

    // Snake body
    const snake = snakeRef.current;
    snake.forEach((seg, i) => {
      if (i === 0) {
        // Head - iced coffee emoji
        ctx.font = `${cellSize - 2}px serif`;
        ctx.fillText(
          COFFEE_HEAD,
          seg.x * cellSize + cellSize / 2,
          seg.y * cellSize + cellSize / 2
        );
      } else {
        // Body segments - brown circles with gradient
        const alpha = 1 - (i / snake.length) * 0.5;
        ctx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
        ctx.shadowColor = "rgba(139, 90, 43, 0.5)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(
          seg.x * cellSize + cellSize / 2,
          seg.y * cellSize + cellSize / 2,
          cellSize / 2 - 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner lighter circle (coffee look)
        ctx.fillStyle = `rgba(180, 130, 70, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(
          seg.x * cellSize + cellSize / 2,
          seg.y * cellSize + cellSize / 2,
          cellSize / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
  }, [currentMoney]);

  // ─── Game loop ──────────────────────────────────────
  const gameLoop = useCallback(() => {
    const { cols, rows } = gridInfoRef.current;
    const snake = [...snakeRef.current];
    const dir = nextDirRef.current;
    dirRef.current = dir;

    // Move head
    const head = { ...snake[0] };
    switch (dir) {
      case "UP":    head.y -= 1; break;
      case "DOWN":  head.y += 1; break;
      case "LEFT":  head.x -= 1; break;
      case "RIGHT": head.x += 1; break;
    }

    // Wall collision
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      const finalScore = scoreRef.current;
      const hs = parseInt(localStorage.getItem("osco-highscore") || "0", 10);
      if (finalScore > hs) {
        localStorage.setItem("osco-highscore", String(finalScore));
        setHighScore(finalScore);
      }
      if (finalScore >= RECORD_TARGET) {
        setGameState("RECORD");
      } else {
        setGameState("GAMEOVER");
      }
      return;
    }

    // Self collision
    if (snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
      const finalScore = scoreRef.current;
      const hs = parseInt(localStorage.getItem("osco-highscore") || "0", 10);
      if (finalScore > hs) {
        localStorage.setItem("osco-highscore", String(finalScore));
        setHighScore(finalScore);
      }
      if (finalScore >= RECORD_TARGET) {
        setGameState("RECORD");
      } else {
        setGameState("GAMEOVER");
      }
      return;
    }

    snake.unshift(head);

    // Eat food?
    const food = foodRef.current;
    if (head.x === food.x && head.y === food.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      setCurrentMoney(randomMoney());

      // New food position (not on snake)
      let newFood: Pos;
      do {
        newFood = randomPos(cols, rows);
      } while (snake.some((s) => s.x === newFood.x && s.y === newFood.y));
      foodRef.current = newFood;

      // Speed up
      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_INCREASE);
    } else {
      snake.pop();
    }

    snakeRef.current = snake;
    draw();

    gameLoopRef.current = setTimeout(gameLoop, speedRef.current);
  }, [draw]);

  // ─── Handle play again (checks limit) ─────────────────
  const handlePlayAgain = useCallback(() => {
    if (playsLeftRef.current <= 0) {
      setGameState("LOCKED");
      setPinInput("");
      setPinError(false);
      return;
    }
  }, []);

  // ─── Handle PIN entry ──────────────────────────────────
  const handlePinSubmit = useCallback(() => {
    if (pinInput === STAFF_PIN) {
      playsLeftRef.current = MAX_PLAYS;
      setPlaysLeft(MAX_PLAYS);
      setPinInput("");
      setPinError(false);
      setGameState("START");
    } else {
      setPinError(true);
      setPinInput("");
    }
  }, [pinInput]);

  // ─── Start game ─────────────────────────────────────
  const startGame = useCallback(() => {
    // Check play limit
    if (playsLeftRef.current <= 0) {
      setGameState("LOCKED");
      setPinInput("");
      setPinError(false);
      return;
    }
    playsLeftRef.current -= 1;
    setPlaysLeft(playsLeftRef.current);

    const { cols, rows } = calculateGrid();
    const midX = Math.floor(cols / 2);
    const midY = Math.floor(rows / 2);

    snakeRef.current = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    dirRef.current = "RIGHT";
    nextDirRef.current = "RIGHT";
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    setScore(0);
    setCurrentMoney(randomMoney());

    // Place food
    let newFood: Pos;
    do {
      newFood = randomPos(cols, rows);
    } while (
      snakeRef.current.some((s) => s.x === newFood.x && s.y === newFood.y)
    );
    foodRef.current = newFood;

    setGameState("PLAYING");
    draw();

    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    gameLoopRef.current = setTimeout(gameLoop, speedRef.current);
  }, [calculateGrid, draw, gameLoop]);

  // ─── Keyboard controls ──────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== "PLAYING") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          startGame();
        }
        return;
      }

      const dir = dirRef.current;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          if (dir !== "DOWN") nextDirRef.current = "UP";
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          if (dir !== "UP") nextDirRef.current = "DOWN";
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          if (dir !== "RIGHT") nextDirRef.current = "LEFT";
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          if (dir !== "LEFT") nextDirRef.current = "RIGHT";
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState, startGame]);

  // ─── Touch controls ─────────────────────────────────
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

      const dir = dirRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > 0 && dir !== "LEFT") nextDirRef.current = "RIGHT";
        else if (dx < 0 && dir !== "RIGHT") nextDirRef.current = "LEFT";
      } else {
        // Vertical swipe
        if (dy > 0 && dir !== "UP") nextDirRef.current = "DOWN";
        else if (dy < 0 && dir !== "DOWN") nextDirRef.current = "UP";
      }
      touchStartRef.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // ─── Cleanup ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, []);

  // ─── Resize ─────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      calculateGrid();
      draw();
    };
    window.addEventListener("resize", onResize);
    calculateGrid();
    return () => window.removeEventListener("resize", onResize);
  }, [calculateGrid, draw]);

  // ─── Mobile D-pad controls ──────────────────────────
  const handleDpad = (dir: Direction) => {
    if (gameState !== "PLAYING") return;
    const current = dirRef.current;
    if (
      (dir === "UP" && current !== "DOWN") ||
      (dir === "DOWN" && current !== "UP") ||
      (dir === "LEFT" && current !== "RIGHT") ||
      (dir === "RIGHT" && current !== "LEFT")
    ) {
      nextDirRef.current = dir;
    }
  };

  // ─── Render ─────────────────────────────────────────
  const { cellSize } = gridInfoRef.current;
  const canvasW = GRID * cellSize;
  const canvasH = GRID * cellSize;

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 select-none">
      {/* ── START SCREEN ── */}
      {gameState === "START" && (
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            src={LOGO_URL}
            alt="Osco Lounge"
            className="float-anim w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]"
          />
          <h1
            className="neon-text text-xl md:text-2xl"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            OSCO LOUNGE
          </h1>
          <p
            className="neon-text-pink text-lg md:text-xl"
            style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "12px" }}
          >
            COLD BREW CHASE
          </p>
          <div className="mt-4 text-2xl md:text-3xl space-y-2 opacity-80">
            <p>☕ Collect the money 💰</p>
            <p>🎯 Reach <span className="neon-text-green">$200</span> to win!</p>
            <p>🏆 Win a FREE cold drink!</p>
          </div>
          {highScore > 0 && (
            <div className="neon-text-green mt-2">
              <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px" }}>
                RECORD: ${highScore}
              </span>
            </div>
          )}
          <button
            onClick={startGame}
            className="mt-6 px-8 py-4 bg-transparent border-2 border-[#F97316] text-[#F97316] rounded-lg text-xl md:text-2xl cursor-pointer pulse-btn hover:bg-[#F97316] hover:text-black transition-colors"
            style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "14px" }}
          >
            START GAME
          </button>
          <div className="text-lg opacity-60 mt-1">
            <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "9px" }}>
              {playsLeft} {playsLeft === 1 ? "PLAY" : "PLAYS"} REMAINING
            </span>
          </div>
          <p className="text-sm opacity-50 mt-2">
            Arrow keys / WASD / Swipe to move
          </p>
        </div>
      )}

      {/* ── PLAYING ── */}
      {gameState === "PLAYING" && (
        <div className="flex flex-col items-center gap-3">
          {/* Score bar */}
          <div className="flex justify-between w-full max-w-[800px] px-2">
            <div className="neon-text-green">
              <span
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  fontSize: "11px",
                }}
              >
                SCORE: ${score}
              </span>
            </div>
            <div className="neon-text-orange">
              <span
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  fontSize: "11px",
                }}
              >
                TARGET: $200
              </span>
            </div>
          </div>

          {/* Game canvas */}
          <div className="neon-border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{ display: "block", width: canvasW, height: canvasH }}
            />
          </div>

          {/* Mobile D-Pad */}
          <div className="md:hidden mt-2 grid grid-cols-3 gap-1 w-40">
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDpad("UP"); }}
              className="w-12 h-12 rounded-lg bg-[#1a1a3a] border border-[#00FFFF33] text-2xl flex items-center justify-center active:bg-[#00FFFF22] mx-auto"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDpad("LEFT"); }}
              className="w-12 h-12 rounded-lg bg-[#1a1a3a] border border-[#00FFFF33] text-2xl flex items-center justify-center active:bg-[#00FFFF22] mx-auto"
            >
              ◄
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDpad("RIGHT"); }}
              className="w-12 h-12 rounded-lg bg-[#1a1a3a] border border-[#00FFFF33] text-2xl flex items-center justify-center active:bg-[#00FFFF22] mx-auto"
            >
              ►
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDpad("DOWN"); }}
              className="w-12 h-12 rounded-lg bg-[#1a1a3a] border border-[#00FFFF33] text-2xl flex items-center justify-center active:bg-[#00FFFF22] mx-auto"
            >
              ▼
            </button>
            <div />
          </div>
        </div>
      )}

      {/* ── GAME OVER ── */}
      {gameState === "GAMEOVER" && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="text-6xl">💔</div>
          <h2
            className="neon-text-pink text-xl"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            GAME OVER
          </h2>
          <div className="text-3xl mt-2">
            <span className="neon-text-green">SCORE: ${score}</span>
          </div>
          <div className="text-xl opacity-60">
            <span>RECORD: ${highScore}</span>
          </div>
          <p className="text-2xl opacity-70 mt-2">
            Reach <span className="neon-text-orange">$200</span> to win a free drink! 💰
          </p>
          {playsLeft > 0 ? (
            <>
              <div className="text-lg opacity-50 mt-1">
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "9px" }}>
                  {playsLeft} {playsLeft === 1 ? "PLAY" : "PLAYS"} LEFT
                </span>
              </div>
              <button
                onClick={startGame}
                className="mt-4 px-8 py-4 bg-transparent border-2 border-[#F97316] text-[#F97316] rounded-lg cursor-pointer pulse-btn hover:bg-[#F97316] hover:text-black transition-colors"
                style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "14px" }}
              >
                TRY AGAIN
              </button>
            </>
          ) : (
            <>
              <div className="text-xl neon-text-pink mt-2">
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px" }}>
                  🔒 NO MORE PLAYS
                </span>
              </div>
              <button
                onClick={() => { setGameState("LOCKED"); setPinInput(""); setPinError(false); }}
                className="mt-4 px-8 py-4 bg-transparent border-2 border-[#FF006E] text-[#FF006E] rounded-lg cursor-pointer hover:bg-[#FF006E22] transition-colors"
                style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "11px" }}
              >
                STAFF UNLOCK
              </button>
            </>
          )}
        </div>
      )}

      {/* ── RECORD BROKEN ── */}
      {gameState === "RECORD" && (
        <div className="flex flex-col items-center gap-5 text-center">
          <Confetti />
          <div className="float-anim text-7xl md:text-8xl">🏆</div>
          <h2
            className="neon-text-orange text-lg md:text-xl"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            NEW RECORD!
          </h2>
          <div
            className="neon-text-green text-2xl"
            style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "16px" }}
          >
            ${score}
          </div>
          <div
            className="mt-4 p-6 rounded-xl text-center max-w-sm"
            style={{
              background:
                "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(255,0,110,0.1))",
              border: "2px solid rgba(249,115,22,0.4)",
              boxShadow: "0 0 30px rgba(249,115,22,0.2)",
            }}
          >
            <p className="text-4xl mb-3">☕🎉</p>
            <p
              className="text-xl md:text-2xl neon-text-orange"
              style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "11px", lineHeight: "2" }}
            >
              CONGRATULATIONS!
            </p>
            <p className="text-2xl md:text-3xl mt-3">
              You won a <span className="neon-text-green">FREE</span> Iced Coffee
            </p>
            <p className="text-2xl md:text-3xl">
              from <span className="neon-text">Osco Lounge</span>!
            </p>
            <p className="text-lg opacity-50 mt-3">
              Show this screen to claim your drink ☕
            </p>
          </div>
          {playsLeft > 0 ? (
            <>
              <div className="text-lg opacity-50 mt-1">
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "9px" }}>
                  {playsLeft} {playsLeft === 1 ? "PLAY" : "PLAYS"} LEFT
                </span>
              </div>
              <button
                onClick={startGame}
                className="mt-4 px-8 py-4 bg-transparent border-2 border-[#00FFFF] text-[#00FFFF] rounded-lg cursor-pointer hover:bg-[#00FFFF22] transition-colors"
                style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "12px" }}
              >
                PLAY AGAIN
              </button>
            </>
          ) : (
            <>
              <div className="text-xl neon-text-pink mt-2">
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px" }}>
                  🔒 NO MORE PLAYS
                </span>
              </div>
              <button
                onClick={() => { setGameState("LOCKED"); setPinInput(""); setPinError(false); }}
                className="mt-4 px-8 py-4 bg-transparent border-2 border-[#FF006E] text-[#FF006E] rounded-lg cursor-pointer hover:bg-[#FF006E22] transition-colors"
                style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "11px" }}
              >
                STAFF UNLOCK
              </button>
            </>
          )}
        </div>
      )}

      {/* ── LOCKED SCREEN ── */}
      {gameState === "LOCKED" && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="text-7xl">🔒</div>
          <h2
            className="neon-text-pink text-lg"
            style={{ fontFamily: "'Press Start 2P', cursive" }}
          >
            GAME LOCKED
          </h2>
          <p className="text-2xl opacity-70 mt-2">
            All 3 plays have been used!
          </p>
          <p className="text-xl opacity-50">
            Ask staff to unlock for the next player
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <p
              className="neon-text text-sm"
              style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px" }}
            >
              STAFF PIN
            </p>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-12 h-14 rounded-lg flex items-center justify-center text-3xl"
                  style={{
                    background: "#0a0a2a",
                    border: `2px solid ${pinInput.length > i ? "#00FFFF" : "#333"}`,
                    color: "#00FFFF",
                    fontFamily: "'Press Start 2P', cursive",
                  }}
                >
                  {pinInput.length > i ? "•" : ""}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
                <button
                  key={key || "empty"}
                  onClick={() => {
                    if (key === "⌫") {
                      setPinInput((p) => p.slice(0, -1));
                      setPinError(false);
                    } else if (key && pinInput.length < 4) {
                      const newPin = pinInput + key;
                      setPinInput(newPin);
                      setPinError(false);
                      if (newPin.length === 4) {
                        if (newPin === STAFF_PIN) {
                          playsLeftRef.current = MAX_PLAYS;
                          setPlaysLeft(MAX_PLAYS);
                          setPinInput("");
                          setPinError(false);
                          setGameState("START");
                        } else {
                          setPinError(true);
                          setTimeout(() => setPinInput(""), 500);
                        }
                      }
                    }
                  }}
                  disabled={!key}
                  className={`w-14 h-14 rounded-lg text-xl flex items-center justify-center transition-colors ${
                    key
                      ? "bg-[#1a1a3a] border border-[#333] text-white hover:bg-[#2a2a4a] active:bg-[#00FFFF22] cursor-pointer"
                      : "bg-transparent border-none"
                  }`}
                  style={{ fontFamily: "'VT323', monospace", fontSize: "24px" }}
                >
                  {key}
                </button>
              ))}
            </div>
            {pinError && (
              <p
                className="neon-text-pink text-sm mt-1"
                style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "9px" }}
              >
                WRONG PIN!
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="fixed bottom-3 text-center opacity-30"
        style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "8px" }}
      >
        OSCO LOUNGE © 2025
      </div>
    </div>
  );
}
