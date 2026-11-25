export const GRID_SIZE = 20;

export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "idle" | "playing" | "paused" | "gameover" | "win";

export interface GameState {
  snake: Point[];
  food: Point;
  direction: Direction;
  status: GameStatus;
  score: number;
}

export const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const INITIAL_SNAKE: Point[] = [
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 },
];

export function createInitialGame(): GameState {
  return {
    snake: INITIAL_SNAKE,
    food: { x: 14, y: 10 },
    direction: "right",
    status: "idle",
    score: 0,
  };
}

export function isOpposite(a: Direction, b: Direction): boolean {
  return (
    (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left")
  );
}

export function createFood(snake: Point[]): Point | null {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }

  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

export function getTickMs(score: number): number {
  const level = Math.floor(score / 50);
  return Math.max(70, 150 - level * 12);
}

export function getSpeedLevel(score: number): number {
  return Math.floor(score / 50) + 1;
}

export function advance(state: GameState, direction: Direction): GameState {
  if (state.status !== "playing") return state;

  const delta = DIRECTIONS[direction];
  const head: Point = {
    x: state.snake[0].x + delta.x,
    y: state.snake[0].y + delta.y,
  };

  const hitWall =
    head.x < 0 || head.y < 0 || head.x >= GRID_SIZE || head.y >= GRID_SIZE;
  if (hitWall) return { ...state, status: "gameover", direction };

  const eating = head.x === state.food.x && head.y === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  const hitSelf = body.some((p) => p.x === head.x && p.y === head.y);
  if (hitSelf) return { ...state, status: "gameover", direction };

  const snake = [head, ...state.snake.slice(0, eating ? undefined : -1)];
  const nextFood = eating ? createFood(snake) : state.food;

  if (eating && nextFood === null) {
    return { ...state, snake, food: state.food, direction, status: "win" };
  }

  return {
    ...state,
    snake,
    food: eating ? nextFood! : state.food,
    direction,
    score: state.score + (eating ? 10 : 0),
  };
}
