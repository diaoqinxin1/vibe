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
  getTickMs,
  GRID_SIZE,
  isOpposite,
  SPEED_PRESETS,
  type Direction,
  type GameState,
  type SpeedLevel,
} from "@/lib/snake";
import { getCloud, type ScoreRow } from "@/lib/cloud";

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

type CloudMessage = { text: string; failed: boolean };

export default function SnakeGame() {
  const [game, setGame] = useState<GameState>(createInitialGame);
  const best = useSyncExternalStore(subscribeBest, readBestScore, () => 0);
  const [playerName, setPlayerName] = useState("匿名玩家");
  const [leaderboard, setLeaderboard] = useState<ScoreRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [cloudMessage, setCloudMessage] = useState<CloudMessage | null>(null);
  const [speed, setSpeed] = useState<SpeedLevel>("normal");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<"native" | "css">("native");

  const directionRef = useRef<Direction>("right");
  const queueRef = useRef<Direction[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const submittedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (game.score > readBestScore()) writeBestScore(game.score);
  }, [game.score]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // iOS Safari 等浏览器不支持元素级 Fullscreen API，用 CSS 模拟全屏代替
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      if (fullscreenMode === "native" && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => setIsFullscreen(false));
      }
      setIsFullscreen(false);
      return;
    }

    const stage = stageRef.current;
    const supportsNative =
      typeof stage?.requestFullscreen === "function" &&
      document.fullscreenEnabled;
    if (supportsNative) {
      void stage!.requestFullscreen().catch(() => {
        setFullscreenMode("css");
        setIsFullscreen(true);
      });
    } else {
      setFullscreenMode("css");
      setIsFullscreen(true);
    }
  }, [isFullscreen, fullscreenMode]);

  const loadBoard = useCallback(async () => {
    try {
      const { data, error } = await getCloud()
        .database.from("snake_scores")
        .select("id, player_name, score, created_at")
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) {
        setCloudMessage({ text: "云端排行榜读取失败，请稍后刷新。", failed: true });
        return;
      }
      setLeaderboard((data ?? []) as ScoreRow[]);
      setBoardLoading(false);
    } catch {
      setCloudMessage({ text: "云端连接失败，请检查网络后刷新。", failed: true });
      setBoardLoading(false);
    }
  }, []);

  const submitScore = useCallback(
    async (name: string, score: number) => {
      const safeName = name.trim().slice(0, 20) || "匿名玩家";
      try {
        const { error } = await getCloud()
          .database.from("snake_scores")
          .insert({ player_name: safeName, score });

        if (error) {
          setCloudMessage({ text: "成绩上传失败，可点击重试。", failed: true });
          return;
        }
        setCloudMessage({ text: "成绩已同步到云端排行榜。", failed: false });
        await loadBoard();
      } catch {
        setCloudMessage({ text: "成绩上传失败，可点击重试。", failed: true });
      }
    },
    [loadBoard],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBoard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBoard]);

  useEffect(() => {
    const ended = game.status === "gameover" || game.status === "win";
    if (ended && game.score > 0 && !submittedRef.current) {
      submittedRef.current = true;
      const timer = window.setTimeout(() => {
        void submitScore(playerName, game.score);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [game.status, game.score, playerName, submitScore]);

  const startGame = useCallback(() => {
    directionRef.current = "right";
    queueRef.current = [];
    submittedRef.current = false;
    setCloudMessage(null);
    setGame({ ...createInitialGame(), status: "playing" });
  }, []);

  const resetGame = useCallback(() => {
    directionRef.current = "right";
    queueRef.current = [];
    submittedRef.current = false;
    setCloudMessage(null);
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
    }, getTickMs(game.score, speed));

    return () => window.clearInterval(timer);
  }, [game.status, game.score, speed]);

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
        return;
      }

      if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
        return;
      }

      if (key === "escape" && fullscreenMode === "css" && isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
        return;
      }

      if (key === "[" || key === "]") {
        event.preventDefault();
        setSpeed((current) => {
          const index = SPEED_PRESETS.findIndex((item) => item.value === current);
          const next = key === "[" ? index - 1 : index + 1;
          const clamped = Math.max(0, Math.min(SPEED_PRESETS.length - 1, next));
          return SPEED_PRESETS[clamped].value;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.status, queueDirection, startGame, togglePause, resetGame, toggleFullscreen, fullscreenMode, isFullscreen]);

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
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl bg-slate-950/85 px-5 text-center backdrop-blur-sm">
        <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-2xl">
          {game.status === "paused" ? "⏸" : game.status === "gameover" ? "💀" : game.status === "win" ? "🏆" : "🐍"}
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {content.title}
          </h2>
          <p className="mt-2 text-sm text-slate-300">{content.description}</p>
        </div>
        <button
          type="button"
          onClick={game.status === "paused" ? togglePause : startGame}
          className="rounded-full bg-emerald-400 px-9 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 active:scale-95 sm:text-base"
        >
          {content.action}
        </button>
        <p className="text-[11px] text-slate-500">点击按钮，或按空格键开始 / 暂停</p>
      </div>
    );
  })();

  const dpad: { direction: Direction; label: string; className: string }[] = [
    { direction: "up", label: "↑", className: "col-start-2 row-start-1" },
    { direction: "left", label: "←", className: "col-start-1 row-start-2" },
    { direction: "right", label: "→", className: "col-start-3 row-start-2" },
    { direction: "down", label: "↓", className: "col-start-2 row-start-3" },
  ];

  const speedLabel =
    SPEED_PRESETS.find((item) => item.value === speed)?.label ?? "正常";

  return (
    <main className="arcade-bg min-h-screen overflow-x-hidden px-3 py-6 text-slate-100 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 sm:gap-5">
        <header className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-400 sm:text-xs">
            Classic Arcade
          </p>
          <h1 className="mt-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
            SNAKE
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">贪吃蛇 · 高分挑战</p>
        </header>

        <div
          ref={stageRef}
          className={`game-stage flex w-full flex-col items-center gap-3 sm:gap-4 ${
            isFullscreen
              ? `justify-center bg-slate-950 p-3 sm:p-5 ${fullscreenMode === "css" ? "css-fullscreen" : ""}`
              : ""
          }`}
        >
          <section className="grid w-full grid-cols-3 gap-1.5 sm:gap-2" aria-label="游戏数据">
            <StatCard label="得分" value={game.score} accent="text-emerald-400" />
            <StatCard label="最高分" value={best} accent="text-cyan-400" />
            <StatCard label="速度" value={speedLabel} accent="text-amber-400" />
          </section>

          <div
            className={`game-board relative w-full shrink-0 aspect-square rounded-2xl border border-slate-700/80 bg-[#0b1220] p-2 shadow-2xl shadow-black/50 sm:rounded-3xl sm:p-3 ${
              isFullscreen ? "max-h-[70vh] w-auto max-w-full" : "max-w-[560px]"
            }`}
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

          <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-400">速度</span>
              <div className="flex gap-0.5 rounded-xl border border-slate-700 bg-slate-900/70 p-1">
                {SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setSpeed(preset.value)}
                    aria-pressed={speed === preset.value}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      speed === preset.value
                        ? "bg-emerald-400 text-slate-950 shadow-sm"
                        : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-300 active:scale-95"
            >
              <span aria-hidden="true">{isFullscreen ? "⤡" : "⤢"}</span>
              {isFullscreen ? "退出全屏" : "全屏游戏"}
            </button>
          </div>

          <div className="flex w-full max-w-xl flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-10">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-slate-500">方向</span>
              <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
                {dpad.map((item) => (
                  <button
                    key={item.direction}
                    type="button"
                    aria-label={item.direction}
                    onClick={() => queueDirection(item.direction)}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-lg font-bold text-slate-200 shadow transition hover:border-emerald-400/70 hover:text-emerald-300 active:scale-95 sm:h-11 sm:w-11 ${item.className}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 sm:pt-5">
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={game.status === "paused" ? togglePause : startGame}
                  className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 active:scale-95 sm:px-5"
                >
                  {game.status === "paused" ? "继续" : "开始 / 暂停"}
                </button>
                <button
                  type="button"
                  onClick={resetGame}
                  className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 active:scale-95 sm:px-5"
                >
                  重新开始
                </button>
              </div>
              <p className="max-w-[220px] text-center text-[11px] leading-5 text-slate-500">
                方向键 / WASD 移动 · 空格暂停
                <br />
                R 重开 · F 全屏 · 手机可滑动棋盘
              </p>
            </div>
          </div>
        </div>

        <section className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl shadow-black/20 backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                <span aria-hidden="true">🏆</span> 云端排行榜
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                每局结束自动上传，展示前 10 名。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="player-name" className="shrink-0 text-xs text-slate-400">
                玩家名
              </label>
              <input
                id="player-name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                maxLength={20}
                className="w-24 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400 sm:w-28"
              />
              <button
                type="button"
                onClick={() => void loadBoard()}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
              >
                刷新
              </button>
            </div>
          </div>

          {cloudMessage && (
            <div
              className={`mt-3 flex flex-wrap items-center gap-2 text-xs ${
                cloudMessage.failed ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              <span>{cloudMessage.text}</span>
              {cloudMessage.failed &&
                game.score > 0 &&
                (game.status === "gameover" || game.status === "win") && (
                  <button
                    type="button"
                    onClick={() => {
                      submittedRef.current = true;
                      void submitScore(playerName, game.score);
                    }}
                    className="font-semibold underline"
                  >
                    重试上传
                  </button>
                )}
            </div>
          )}

          {boardLoading ? (
            <p className="mt-4 text-sm text-slate-400">正在读取云端成绩…</p>
          ) : leaderboard.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              还没有成绩，快来占据第一名。
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {leaderboard.map((row, index) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`w-5 shrink-0 text-center font-bold ${
                        index === 0
                          ? "text-amber-400"
                          : index === 1
                            ? "text-slate-300"
                            : index === 2
                              ? "text-orange-400"
                              : "text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate font-medium text-slate-200">
                      {row.player_name}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-emerald-400">
                    {row.score} 分
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="pb-2 text-center text-[11px] text-slate-600">
          Next.js · React · Tailwind CSS · WorkBuddy Cloud
        </p>
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
    <div className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-900/70 px-2 py-2.5 text-center shadow backdrop-blur sm:rounded-2xl sm:px-4 sm:py-3">
      <p className="truncate text-[10px] font-medium tracking-wide text-slate-400 sm:text-xs">
        {label}
      </p>
      <p className={`mt-0.5 truncate text-lg font-bold sm:text-2xl ${accent}`}>
        {value}
      </p>
    </div>
  );
}
