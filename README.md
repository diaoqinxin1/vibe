# 贪吃蛇 · Snake Game

使用 Next.js 16（App Router）、React 19、TypeScript 和 Tailwind CSS 4 实现的经典贪吃蛇游戏。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000 。

生产构建：

```bash
npm run build
npm start
```

## 玩法

- 方向键 / WASD 控制移动，空格键开始或暂停，`R` 重新开始
- 手机端可以在棋盘上滑动，或使用屏幕上的方向按钮
- 吃到食物得 10 分并变长；撞墙或撞到自己则游戏结束
- 每 50 分速度提升一级，最高分保存在浏览器 localStorage 中

## 代码结构

- `src/lib/snake.ts`：纯游戏逻辑（移动、碰撞、食物生成、速度计算）
- `src/components/SnakeGame.tsx`：游戏界面与键盘/触控交互
- `src/app/page.tsx`：页面入口

## 说明

当前环境的 Turbopack 原生模块不可用，因此 `dev` / `build` 脚本显式使用 `--webpack` 构建。
