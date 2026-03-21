# 徽纸艺境

徽派建筑照片转黑白剪纸候选图的 `Vite + React` 应用。

当前仓库已经整理为可直接部署到 `Cloudflare Pages` 的形态：
- 前端为 `Vite SPA`
- 生产接口位于 `functions/api/*`
- 任务状态和结果图片使用 `Cloudflare KV`
- 首页提交后停留在首页，并逐张显示候选图

## 本地开发

要求：
- Node.js 20+
- pnpm 10+

安装依赖：

```bash
corepack pnpm install
```

复制环境变量：

```bash
cp .env.example .env.local
```

推荐填写：
- `VOLCENGINE_API_KEY`
- `VOLCENGINE_MODEL_ID`

当前默认模型：
- `doubao-seededit-3-0-i2i-250628`

兼容旧链路时也支持：
- `VOLCENGINE_ACCESS_KEY_ID`
- `VOLCENGINE_SECRET_ACCESS_KEY`
- `VOLCENGINE_REQ_KEY`

启动开发服务：

```bash
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

本地开发仍使用 `vite.config.ts` 里的 `/api/*` 中间件；Cloudflare 生产环境使用 `functions/api/*`。

## 部署到 Cloudflare Pages

1. 将仓库推送到 GitHub。
2. 在 Cloudflare Dashboard 中创建 Pages 项目并连接该仓库。
3. 构建配置填写：
   - Build command: `corepack pnpm build`
   - Build output directory: `dist`
   - Root directory: 留空
4. 在 `Settings -> Variables and Secrets` 中添加：
   - Secret: `VOLCENGINE_API_KEY`
   - Variable 或 Secret: `VOLCENGINE_MODEL_ID`
5. 在 `Settings -> Bindings` 中添加一个 KV 绑定，名称必须是：
   - `HUI_PAPER_ART_KV`
6. 触发重新部署。

如果你仍要保留旧的视觉 OpenAPI 方案，也可以继续配置：
- `VOLCENGINE_ACCESS_KEY_ID`
- `VOLCENGINE_SECRET_ACCESS_KEY`
- `VOLCENGINE_REQ_KEY`

当 `VOLCENGINE_API_KEY` 存在时，系统会优先使用 Ark API Key 模式。

## 路由说明

应用使用 `HashRouter`，部署后地址形态为：
- 首页：`https://your-site.pages.dev/#/`
- 结果页：`https://your-site.pages.dev/#/result/:generationId`

## 关键文件

- `src/pages/HomePage.tsx`：首页交互与实时候选图显示
- `src/db/api.ts`：前端 API 请求
- `functions/api/generate.ts`：Cloudflare 生成入口
- `functions/api/generations/[id].ts`：任务详情
- `functions/api/generations/[id]/status.ts`：任务状态
- `functions/_lib/storage.ts`：KV 存储适配
- `functions/_lib/volcengine.ts`：Ark API Key / 旧 Visual AK/SK 双通道请求层
- `wrangler.jsonc`：Cloudflare Pages 配置

## 验证

```bash
corepack pnpm exec tsc -p tsconfig.check.json --noEmit
corepack pnpm exec tsc -p tsconfig.cloudflare.json --noEmit
corepack pnpm build
```
