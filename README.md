# 徽纸艺境

徽派建筑照片转黑白剪纸候选图的 `Vite + React` 应用。

当前仓库已经整理为可直接部署到 `Cloudflare Pages` 的形态：
- 前端是 `Vite SPA`
- 生产接口位于 `functions/api/*`
- 生成任务状态和结果图片使用 `Cloudflare KV`
- 首页提交后会停留在首页，并逐张显示候选图

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

需要填写：
- `VOLCENGINE_ACCESS_KEY_ID`
- `VOLCENGINE_SECRET_ACCESS_KEY`
- `VOLCENGINE_REQ_KEY`

启动开发服务：

```bash
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

本地开发仍然使用 `vite.config.ts` 里的 `/api/*` 中间件。Cloudflare 生产环境使用 `functions/api/*`。

## 部署到 Cloudflare Pages

1. 将仓库推送到 GitHub。
2. 在 Cloudflare Dashboard 中创建 Pages 项目并连接该仓库。
3. 构建配置填写：
   - Build command: `corepack pnpm build`
   - Build output directory: `dist`
4. 在 `Settings -> Variables and Secrets` 中添加：
   - Secret: `VOLCENGINE_ACCESS_KEY_ID`
   - Secret: `VOLCENGINE_SECRET_ACCESS_KEY`
   - Variable 或 Secret: `VOLCENGINE_REQ_KEY`
5. 在 `Settings -> Bindings` 中添加一个 KV 绑定，名称必须是：
   - `HUI_PAPER_ART_KV`
6. 触发部署。

也可以用 Wrangler 直接部署。仓库已包含 [wrangler.jsonc](./wrangler.jsonc)，并把 `pages_build_output_dir` 设为 `dist`。

## 路由说明

应用已使用 `HashRouter`，部署后页面地址会是：
- 首页：`https://your-site.pages.dev/#/`
- 结果页：`https://your-site.pages.dev/#/result/:generationId`

## 关键文件

- `src/pages/HomePage.tsx`：首页交互与实时候选图显示
- `src/db/api.ts`：前端 API 请求
- `functions/api/generate.ts`：Cloudflare 生成入口
- `functions/api/generations/[id].ts`：任务详情
- `functions/api/generations/[id]/status.ts`：任务状态
- `functions/_lib/storage.ts`：KV 存储适配
- `functions/_lib/volcengine.ts`：火山引擎签名与请求
- `wrangler.jsonc`：Cloudflare Pages 配置

## 验证

```bash
corepack pnpm exec tsc -p tsconfig.check.json --noEmit
corepack pnpm exec tsc -p tsconfig.cloudflare.json --noEmit
corepack pnpm build
```
