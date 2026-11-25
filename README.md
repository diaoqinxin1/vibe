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
- 每 50 分速度提升一级，个人最高分保存在浏览器本地
- 每局结束后成绩自动上传到云端排行榜，展示所有玩家的前 10 名

## 云服务

应用已接入 WorkBuddy 云服务（云数据库）。表名 `snake_scores`，仅开放公开读取与新增，不允许客户端修改或删除成绩。客户端配置位于 `src/lib/cloud.ts`，来自应用的 `publicConfig`，不含长期密钥。

## 代码结构

- `src/lib/snake.ts`：纯游戏逻辑（移动、碰撞、食物生成、速度计算）
- `src/lib/cloud.ts`：云服务客户端初始化与公开配置
- `src/components/SnakeGame.tsx`：游戏界面、键盘/触控交互与云端排行榜
- `src/app/page.tsx`：页面入口

## 说明

当前环境的 Turbopack 原生模块不可用，因此 `dev` / `build` 脚本显式使用 `--webpack` 构建。
