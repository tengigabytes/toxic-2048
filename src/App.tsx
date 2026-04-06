import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Bomb, RotateCcw, Play, Share2, Flame, TrendingUp } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * TOXIC 2048: Rush Edition
 * Core Game Logic and UI
 */

const GRID_SIZE = 4;
const BASE_TILE_CHANCE = 0.9; 
const RUSH_THRESHOLD = 5;

// --- Interfaces & Types ---
interface Tile {
  id: number;
  value: number;
  x: number;
  y: number;
  mergedFrom?: Tile[];
  isNew?: boolean;
}

interface GameState {
  grid: (Tile | null)[][];
  score: number;
  highScore: number;
  todayBest: number;
  combo: number;
  rushCounter: number;
  isRushMode: boolean;
  gameOver: boolean;
  streak: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

interface ScorePopup {
  id: number;
  x: number;
  y: number;
  value: string;
  color: string;
}

// --- Utility Functions ---
const getRandomInt = (max: number) => Math.floor(Math.random() * max);

/**
 * Returns a dynamic color and style properties for a tile.
 * Uses HSL to ensure a continuous spectrum for astronomical numbers.
 */
const getTileStyle = (value: number, isRushMode: boolean) => {
  const logVal = Math.log2(value);
  
  // Base colors for early stages
  if (value === 2) return { color: '#3b82f6', glow: 0, pulse: false };
  if (value === 4) return { color: '#06b6d4', glow: 0, pulse: false };
  if (value === 16) return { color: '#10b981', glow: 5, pulse: false };
  if (value === 256) return { color: '#84cc16', glow: 10, pulse: false };
  if (value === 65536) return { color: '#eab308', glow: 15, pulse: false };
  if (value === 4294967296) return { color: '#f97316', glow: 20, pulse: true };
  
  // Dynamic HSL for higher values: Cycles through neon spectrum
  const hue = (logVal * 35) % 360;
  return {
    color: `hsl(${hue}, 80%, 55%)`,
    glow: Math.min(logVal * 2, 40),
    pulse: value > 4294967296
  };
};

// Keep getTileColor for simple backward compatibility where needed
const getTileColor = (value: number) => getTileStyle(value, false).color;

// --- Main Application Component ---
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Initialize state from LocalStorage for persistence
  const [gameState, setGameState] = useState<GameState>(() => {
    const lastPlayed = localStorage.getItem('toxic-2048-last-played');
    const today = new Date().toDateString();
    let streak = parseInt(localStorage.getItem('toxic-2048-streak') || '0');
    let todayBest = parseInt(localStorage.getItem('toxic-2048-today') || '0');

    if (lastPlayed !== today) {
      if (lastPlayed) {
        const lastDate = new Date(lastPlayed);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate.toDateString() !== yesterday.toDateString()) {
          streak = 0; 
        }
      }
      todayBest = 0; 
      localStorage.setItem('toxic-2048-today', '0');
      localStorage.setItem('toxic-2048-last-played', today);
    }

    return {
      grid: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
      score: 0,
      highScore: parseInt(localStorage.getItem('toxic-2048-high') || '0'),
      todayBest,
      combo: 0,
      rushCounter: 0,
      isRushMode: false,
      gameOver: false,
      streak,
    };
  });

  const [popups, setPopups] = useState<ScorePopup[]>([]);
  const nextId = useRef(0);
  const particles = useRef<Particle[]>([]);
  const animationFrame = useRef<number>(0);
  const lastTouch = useRef<{ x: number, y: number } | null>(null);

  /**
   * Helper to draw rounded rectangles on the Canvas
   */
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  };

  /**
   * Spawns a new tile in an empty cell.
   * "Toxic Spawning" increases the base value as the player's score grows.
   */
  const spawnTile = useCallback((grid: (Tile | null)[][], score: number) => {
    const emptyCells: { x: number, y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!grid[y][x]) emptyCells.push({ x, y });
      }
    }

    if (emptyCells.length === 0) return grid;

    const { x, y } = emptyCells[getRandomInt(emptyCells.length)];
    
    let value = 2;
    const randValue = Math.random();
    if (score > 10000) {
      if (randValue < 0.4) value = 2;
      else if (randValue < 0.7) value = 4;
      else value = 16; // Changed from 8 to 16 to maintain sequence compatibility
    } else if (score > 2000) {
      value = randValue < 0.6 ? 2 : 4;
    } else {
      value = randValue < 0.9 ? 2 : 4;
    }

    const newTile: Tile = { id: nextId.current++, value, x, y, isNew: true };
    const newGrid = [...grid.map(row => [...row])];
    newGrid[y][x] = newTile;
    return newGrid;
  }, []);

  /**
   * Resets the game state
   */
  const initGame = useCallback(() => {
    let grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    grid = spawnTile(grid, 0);
    grid = spawnTile(grid, 0);
    
    const today = new Date().toDateString();
    const lastPlayed = localStorage.getItem('toxic-2048-last-played');
    if (lastPlayed !== today) {
      setGameState(prev => {
        const newStreak = prev.streak + 1;
        localStorage.setItem('toxic-2048-streak', newStreak.toString());
        localStorage.setItem('toxic-2048-last-played', today);
        return { ...prev, streak: newStreak };
      });
    }

    setGameState(prev => ({
      ...prev,
      grid,
      score: 0,
      combo: 0,
      rushCounter: 0,
      isRushMode: false,
      gameOver: false,
    }));
  }, [spawnTile]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const addParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        color,
        life: 1,
        size: Math.random() * 4 + 2
      });
    }
  };

  const addPopup = (x: number, y: number, value: string, color: string) => {
    const id = Date.now() + Math.random();
    setPopups(prev => [...prev, { id, x, y, value, color }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  /**
   * Main movement logic
   */
  const move = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState.gameOver) return;

    let moved = false;
    let newScore = gameState.score;
    let mergesInSwipe = 0;

    const newGrid = [...gameState.grid.map(row => [...row])];

    const traverse = (callback: (x: number, y: number) => void) => {
      const xs = direction === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];
      const ys = direction === 'down' ? [3, 2, 1, 0] : [0, 1, 2, 3];
      ys.forEach(y => xs.forEach(x => callback(x, y)));
    };

    const getVector = () => {
      switch (direction) {
        case 'up': return { x: 0, y: -1 };
        case 'down': return { x: 0, y: 1 };
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
      }
    };

    const vector = getVector();
    const mergedIds = new Set<number>();

    traverse((x, y) => {
      const tile = newGrid[y][x];
      if (!tile) return;

      let currX = x;
      let currY = y;
      let nextX = currX + vector.x;
      let nextY = currY + vector.y;

      while (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
        const nextTile = newGrid[nextY][nextX];
        if (!nextTile) {
          newGrid[nextY][nextX] = { ...tile, x: nextX, y: nextY };
          newGrid[currY][currX] = null;
          currX = nextX;
          currY = nextY;
          nextX = currX + vector.x;
          nextY = currY + vector.y;
          moved = true;
        } else if (nextTile.value === tile.value && !mergedIds.has(nextTile.id) && !mergedIds.has(tile.id)) {
          // MULTIPLICATION MERGE LOGIC
          let newValue = tile.value * tile.value;

          let mergeScore = Math.floor(Math.log2(newValue)) * 100; 

          mergesInSwipe++;
          const comboMult = mergesInSwipe > 1 ? (mergesInSwipe === 2 ? 1.5 : mergesInSwipe === 3 ? 2 : 3) : 1;
          const finalScore = Math.floor(mergeScore * comboMult * (gameState.isRushMode ? 2 : 1));
          newScore += finalScore;

          newGrid[nextY][nextX] = { 
            ...nextTile, 
            value: newValue, 
            mergedFrom: [nextTile, tile] 
          };
          newGrid[currY][currX] = null;
          mergedIds.add(nextTile.id);
          moved = true;

          addParticles(nextX * 100 + 50, nextY * 100 + 50, getTileColor(newValue));
          addPopup(nextX * 100 + 50, nextY * 100 + 50, `+${finalScore}`, getTileColor(newValue));
          break;
        } else {
          break;
        }
      }
    });

    if (moved) {
      const gridAfterSpawn = spawnTile(newGrid, newScore);
      const isRush = mergesInSwipe > 0 ? gameState.rushCounter + 1 >= RUSH_THRESHOLD : false;
      
      setGameState(prev => {
        const updatedScore = newScore;
        const updatedHigh = Math.max(prev.highScore, updatedScore);
        const updatedToday = Math.max(prev.todayBest, updatedScore);
        
        localStorage.setItem('toxic-2048-high', updatedHigh.toString());
        localStorage.setItem('toxic-2048-today', updatedToday.toString());

        return {
          ...prev,
          grid: gridAfterSpawn,
          score: updatedScore,
          highScore: updatedHigh,
          todayBest: updatedToday,
          combo: mergesInSwipe,
          rushCounter: mergesInSwipe > 0 ? prev.rushCounter + 1 : 0,
          isRushMode: isRush || (mergesInSwipe > 0 && prev.isRushMode),
          gameOver: checkGameOver(gridAfterSpawn),
        };
      });
      
      if (isRush && !gameState.isRushMode) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#06b6d4', '#10b981']
        });
      }
    }
  };

  const checkGameOver = (grid: (Tile | null)[][]) => {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!grid[y][x]) return false;
        const val = grid[y][x]!.value;
        if (x < GRID_SIZE - 1 && grid[y][x + 1]?.value === val) return false;
        if (y < GRID_SIZE - 1 && grid[y + 1][x]?.value === val) return false;
      }
    }
    return true;
  };

  // --- Animation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Background
      ctx.fillStyle = '#1e293b';
      drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 10);

      const cellSize = 90;
      const gap = 8;
      
      // Empty grid cells
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          ctx.fillStyle = '#334155';
          drawRoundedRect(ctx, x * (cellSize + gap) + gap, y * (cellSize + gap) + gap, cellSize, cellSize, 8);
        }
      }

      // Render Active Tiles
      gameState.grid.forEach((row, y) => {
        row.forEach((tile, x) => {
          if (!tile) return;
          const style = getTileStyle(tile.value, gameState.isRushMode);
          const tx = x * (cellSize + gap) + gap;
          const ty = y * (cellSize + gap) + gap;
          
          // Apply Pulsing Effect for high-value tiles
          let currentCellSize = cellSize;
          let offset = 0;
          if (style.pulse) {
            const pulseAmount = Math.sin(Date.now() / 200) * 3;
            currentCellSize += pulseAmount;
            offset = -pulseAmount / 2;
          }

          ctx.shadowBlur = (gameState.isRushMode ? 25 : 10) + style.glow;
          ctx.shadowColor = style.color;
          ctx.fillStyle = style.color;
          
          drawRoundedRect(ctx, tx + offset, ty + offset, currentCellSize, currentCellSize, 8);
          ctx.shadowBlur = 0;

          // Text Contrast
          ctx.fillStyle = tile.value > 4 ? 'white' : '#1e293b';
          
          // Responsive font size for huge numbers
          const valStr = formatValue(tile.value);
          let fontSize = 32;
          if (valStr.length > 8) fontSize = 16;
          else if (valStr.length > 5) fontSize = 20;
          else if (valStr.length > 3) fontSize = 26;
          
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(valStr, tx + cellSize / 2, ty + cellSize / 2 + (fontSize / 3));
        });
      });

      // Update and draw particles
      particles.current = particles.current.filter(p => p.life > 0);
      particles.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      animationFrame.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame.current);
  }, [gameState]);

  // --- Interaction Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) move('up');
      if (['ArrowDown', 's', 'S'].includes(e.key)) move('down');
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) move('left');
      if (['ArrowRight', 'd', 'D'].includes(e.key)) move('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!lastTouch.current) return;
    const dx = e.changedTouches[0].clientX - lastTouch.current.x;
    const dy = e.changedTouches[0].clientY - lastTouch.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 30) {
      if (absX > absY) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }
    }
    lastTouch.current = null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-4 font-sans overflow-hidden select-none">
      {/* HUD Header */}
      <div className="w-full max-w-md flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 italic">
              TOXIC 2048
            </h1>
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Rush Edition</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-center min-w-[80px]">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Score</p>
              <p className="text-xl font-black text-blue-400">{gameState.score}</p>
            </div>
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-center min-w-[80px]">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Best</p>
              <p className="text-xl font-black text-purple-400">{gameState.highScore}</p>
            </div>
          </div>
        </div>

        {/* Rush Mode Indicator */}
        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${gameState.isRushMode ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              <Flame size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Rush Mode</p>
              <div className="flex gap-1 mt-1">
                {[...Array(RUSH_THRESHOLD)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 w-6 rounded-full transition-all duration-300 ${i < gameState.rushCounter ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-slate-800'}`} 
                  />
                ))}
              </div>
            </div>
          </div>
          <button 
            onClick={initGame}
            title="Reset Game"
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all active:scale-95"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Game Stage */}
      <div 
        className="relative bg-slate-900 p-2 rounded-3xl border-4 border-slate-800 shadow-2xl touch-none w-full max-w-[400px] aspect-square"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={400} 
          className="rounded-2xl w-full h-full"
        />

        {/* Dynamic Score Popups */}
        <AnimatePresence>
          {popups.map(popup => (
            <motion.div
              key={popup.id}
              initial={{ opacity: 1, y: popup.y, x: popup.x }}
              animate={{ opacity: 0, y: popup.y - 100 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none font-black text-2xl drop-shadow-lg"
              style={{ color: popup.color, left: popup.x, top: popup.y }}
            >
              {popup.value}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Rush Mode Visual Polish */}
        {gameState.isRushMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            className="absolute inset-0 bg-orange-500 pointer-events-none rounded-2xl animate-pulse"
          />
        )}

        {/* Death Screen */}
        <AnimatePresence>
          {gameState.gameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 rounded-2xl text-center z-50"
            >
              <Trophy size={64} className="text-yellow-400 mb-4 animate-bounce" />
              <h2 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                GAME OVER
              </h2>
              <p className="text-slate-400 mb-8 font-medium italic">
                "One more run for the toxic throne?"
              </p>
              
              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Final Score</p>
                  <p className="text-2xl font-black text-blue-400">{gameState.score}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Today's Best</p>
                  <p className="text-2xl font-black text-purple-400">{gameState.todayBest}</p>
                </div>
              </div>

              <button 
                onClick={initGame}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl font-black text-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Play fill="currentColor" /> TRY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Details */}
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-slate-500">
        <div className="flex items-center gap-2 bg-slate-900/30 px-4 py-2 rounded-full border border-slate-800/30">
          <TrendingUp size={14} className="text-green-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Toxic Growth</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/30 px-4 py-2 rounded-full border border-slate-800/30">
          <Zap size={14} className="text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Multi Merge</span>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
        High-Performance Neon Edition
      </p>
    </div>
  );
}
full border border-slate-800/30">
          <Zap size={14} className="text-yellow-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Multi Merge</span>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
        High-Performance Neon Edition
      </p>
    </div>
  );
}
