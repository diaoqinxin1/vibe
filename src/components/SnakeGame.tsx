"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type TouchEvent,
} from "react";
import {
  advance,
  createInitialGame,
  getSpeedLevel,
  getTickMs,
  GRID_SIZE,
  isOpposite,
  type Direction,
  type GameState,
} from "@/lib/snake";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

const BEST_SCORE_KEY = "snake-best-score";
const bestListeners = new Set<() => void>();

function readBestScore(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(BEST_SCORE_KEY) ?? 0) || 0;
}

function subscribeBest(listener: () => void): () => void {
  bestListeners.add(listener);
  return () => {
    bestListeners.delete(listener);
  };
}

function writeBestScore(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  bestListeners.forEach((listener) => listener());
}

type Cell = {
  key: string;
  kind: "empty" | "head" | "body" | "food";
  index: number;
};

export default function SnakeGame() {
  const [game, setGame] = useState<GameState>(createInitialGame);
  const best = useSyncExternalStore(subscribeBest, readBestScore, () => 0);

  const directionRef = useRef<Direction>("right");
  const queueRef = useRef<Direction[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (game.score > readBestScore()) writeBestScore(game.score);
  }, [game.score]);

  const startGame = useCallback(() => {
    directionRef.current = "right";
    queueRef.current = [];
    setGame({ ...createInitialGame(), status: "playing" });
  }, []);

  const resetGame = useCallback(() => {
    directionRef.current = "right";
    queueRef.current = [];
    setGame(createInitialGame());
  }, []);

  const togglePause = useCallback(() => {
    setGame((prev) => {
      if (prev.status === "playing") return { ...prev, status: "paused" };
      if (prev.status === "paused") return { ...prev, status: "playing" };
      return prev;
    });
  }, []);

  const queueDirection = useCallback((next: Direction) => {
    const queue = queueRef.current;
    const last = queue.length > 0 ? queue[queue.length - 1] : directionRef.current;
    if (next === last || isOpposite(next, last)) return;
    if (queue.length < 2) queue.push(next);
  }, []);

  useEffect(() => {
    if (game.status !== "playing") return;

    const timer = window.setInterval(() => {
      const next = queueRef.current.shift() ?? directionRef.current;
      directionRef.current = next;
      setGame((prev) => advance(prev, next));
    }, getTickMs(game.score));

    return () => window.clearInterval(timer);
  }, [game.status, game.score]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const direction = KEY_TO_DIRECTION[key];

      if (direction) {
        event.preventDefault();
        queueDirection(direction);
        return;
      }

      if (key === " " || key === "enter") {
        event.preventDefault();
        if (game.status === "playing" || game.status === "paused") {
          togglePause();
        } else {
          startGame();
        }
        return;
      }

      if (key === "r") {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.status, queueDirection, startGame, togglePause, resetGame]);

  const cells = useMemo<Cell[]>(() => {
    const occupied = new Map<string, number>();
    game.snake.forEach((segment, index) => {
      occupied.set(`${segment.x},${segment.y}`, index);
    });

    const result: Cell[] = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const key = `${x},${y}`;
        let kind: Cell["kind"] = "empty";
        let index = -1;

        if (occupied.has(key)) {
          index = occupied.get(key)!;
          kind = index === 0 ? "head" : "body";
        } else if (game.food.x === x && game.food.y === y) {
          kind = "food";
        }

        result.push({ key, kind, index });
      }
    }
    return result;
  }, [game.snake, game.food]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? "right" : "left");
    } else {
      queueDirection(dy > 0 ? "down" : "up");
    }
  };

  const overlay = (() => {
    if (game.status === "playing") return null;

    const content = {
      idle: {
        title: "准备好了吗？",
        description: "吃掉食物变长，别撞墙也别咬到自己。",
        action: "开始游戏",
      },
      paused: {
        title: "已暂停",
        description: "歇一口气，随时继续。",
        action: "继续游戏",
      },
      gameover: {
        title: "游戏结束",
        description: `本局得分 ${game.score} 分`,
        action: "再来一局",
      },
      win: {
        title: "通关啦！",
        description: "整块棋盘都被你占领了。",
        action: "再玩一次",
      },
    }[game.status];

    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-3xl bg-[#060c17]/80 px-6 text-center backdrop-blur-sm">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {content.title}
          </h2>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            {content.description}
          </p>
        </div>
        <button
          type="button"
          onClick={game.status === "paused" ? togglePause : startGame}
          className="rounded-full bg-emerald-400 px-8 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 active:scale-95 sm:text-base"
        >
          {content.action}
        </button>
        <p className="text-xs text-slate-500">也可以按空格键开始 / 暂停</p>
      </div>
    );
  })();

  const dpad: { direction: Direction; label: string; className: string }[] = [
    { direction: "up", label: "↑", className: "col-start-2 row-start-1" },
    { direction: "left", label: "←", className: "col-start-1 row-start-2" },
    { direction: "right", label: "→", className: "col-start-3 row-start-2" },
    { direction: "down", label: "↓", className: "col-start-2 row-start-3" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600">
            Classic Arcade
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl">
            SNAKE
          </h1>
          <p className="mt-2 text-sm text-slate-500">贪吃蛇 · 用 Next.js 构建</p>
        </header>

        <section className="grid w-full max-w-xl grid-cols-3 gap-3" aria-label="游戏数据">
          <StatCard label="当前得分" value={game.score} accent="text-emerald-600" />
          <StatCard label="最高分" value={best} accent="text-cyan-600" />
          <StatCard
            label="速度"
            value={`Lv.${getSpeedLevel(game.score)}`}
            accent="text-amber-500"
          />
        </section>

        <div
          className="relative w-full max-w-[560px] aspect-square rounded-3xl border border-slate-800 bg-[#0b1220] p-2 shadow-2xl shadow-slate-900/20 sm:p-3"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: "none" }}
        >
          <div
            className="grid h-full w-full gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            }}
            role="img"
            aria-label="贪吃蛇游戏棋盘"
          >
            {cells.map((cell) => (
              <div
                key={cell.key}
                className={`rounded-[22%] ${
                  cell.kind === "head"
                    ? "snake-head"
                    : cell.kind === "body"
                      ? "snake-body"
                      : cell.kind === "food"
                        ? "food-cell"
                        : "bg-[#111d31]"
                }`}
                style={
                  cell.kind === "body"
                    ? { opacity: Math.max(0.5, 1 - cell.index * 0.035) }
                    : undefined
                }
              />
            ))}
          </div>
          {overlay}
        </div>

        <section className="flex w-full max-w-xl flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-slate-500">方向控制</span>
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
              {dpad.map((item) => (
                <button
                  key={item.direction}
                  type="button"
                  aria-label={item.direction}
                  onClick={() => queueDirection(item.direction)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:border-emerald-400 hover:text-emerald-600 active:scale-95 ${item.className}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={game.status === "paused" ? togglePause : startGame}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-95"
              >
                {game.status === "paused" ? "继续" : "开始 / 暂停"}
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 active:scale-95"
              >
                重新开始
              </button>
            </div>
            <p className="max-w-xs text-center text-xs leading-5 text-slate-500 sm:text-right">
              方向键 / WASD 移动 · 空格暂停 · R 重开
              <br />
              手机端可在棋盘上滑动
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-3 text-center shadow-sm backdrop-blur sm:px-5 sm:py-4">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 sm:text-xs">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${accent}`}>{value}</p>
    </div>
  );
}
