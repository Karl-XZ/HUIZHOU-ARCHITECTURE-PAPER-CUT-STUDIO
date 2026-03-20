# 徽纸艺境

徽派建筑照片转黑白刻纸候选图的 Vite + React 应用。

当前仓库已经整理为可直接部署到 Vercel 的形态：
- 前端是 Vite SPA
- `/api/*` 使用 Vercel Functions
- 生成任务状态和结果图片使用 Vercel Runtime Cache
- 不再依赖 Supabase 才能跑通主流程

## 本地开发

要求：
- Node.js 20+
- pnpm 10+

安装依赖：

```bash
corepack pnpm install
```

配置环境变量：

```bash
cp .env.example .env.local
```

需要填写：
- `VOLCENGINE_ACCESS_KEY_ID`
- `VOLCENGINE_SECRET_ACCESS_KEY`
- `VOLCENGINE_REQ_KEY`

启动：

```bash
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

## 部署到 Vercel

1. 把仓库推到 GitHub
2. 在 Vercel 导入这个仓库
3. 在 Vercel 项目环境变量里添加：
   - `VOLCENGINE_ACCESS_KEY_ID`
   - `VOLCENGINE_SECRET_ACCESS_KEY`
   - `VOLCENGINE_REQ_KEY`
4. 直接触发部署

部署后即可访问，不需要再单独部署 Supabase 或其他后端服务。

## 运行方式

- 首页上传建筑图片
- 点击生成后，页面会停留在首页
- 候选图会在首页逐张出现
- 前端轮询：
  - `POST /api/generate`
  - `GET /api/generations/:id/status`
  - `GET /api/generations/:id`

## 关键文件

- `src/pages/HomePage.tsx`：首页交互与实时候选图展示
- `src/db/api.ts`：前端 API 请求
- `api/generate.ts`：Vercel 生成入口
- `api/generation-status.ts`：Vercel 状态查询
- `api/generation.ts`：Vercel 任务详情查询
- `vercel.json`：Vercel 重写规则与函数配置

## 验证

```bash
corepack pnpm exec tsc -p tsconfig.check.json --noEmit
corepack pnpm build
```
