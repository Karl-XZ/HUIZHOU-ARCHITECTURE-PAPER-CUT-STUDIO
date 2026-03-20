import { createHash, createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { miaodaDevPlugin } from 'miaoda-sc-plugin';
import svgr from 'vite-plugin-svgr';

interface GenerateRequest {
  uploadedImages: string[];
  basePrompt: string;
  transformPrompt: string;
  styleType: string;
  styleKeywords?: string;
  aiCompletionEnabled: boolean;
  aiCompletionPrompt?: string;
  finalPrompt: string;
  generationCount: number;
  candidatePlans?: Array<{
    prompt: string;
    uploadedImages: string[];
    variantLabel?: string;
  }>;
}

interface StoredGeneration {
  id: string;
  created_at: string;
  uploaded_images: string[];
  base_prompt: string;
  transform_prompt: string;
  style_type: string;
  style_keywords?: string;
  ai_completion_enabled: boolean;
  ai_completion_prompt?: string;
  final_prompt: string;
  generation_count: number;
  status: 'processing' | 'completed' | 'failed';
  task_ids: string[];
  result_images: string[];
  failed_count: number;
  error_message?: string;
}

interface VolcengineResponse {
  code: number;
  message?: string;
  data?: {
    binary_data_base64?: string[];
  };
}

const generationStore = new Map<string, StoredGeneration>();

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function sendJson(
  res: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
  statusCode: number,
  payload: unknown,
) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sha256Hex(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

function hmacRaw(key: Buffer | string, content: string) {
  return createHmac('sha256', key).update(content).digest();
}

function toXDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getGenerationProgress(generation: StoredGeneration) {
  const success = generation.result_images.length;
  const failed = generation.failed_count;
  const total = generation.generation_count;

  return {
    total,
    success,
    failed,
    pending: Math.max(total - success - failed, 0),
  };
}

async function callVolcengine(
  accessKeyId: string,
  secretAccessKey: string,
  body: Record<string, unknown>,
) {
  const host = 'visual.volcengineapi.com';
  const service = 'cv';
  const version = '2022-08-31';
  const region = 'cn-north-1';
  const action = 'CVProcess';
  const contentType = 'application/json';
  const method = 'POST';
  const query = `Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(version)}`;
  const requestBody = JSON.stringify(body);
  const xDate = toXDate(new Date());
  const shortXDate = xDate.slice(0, 8);
  const xContentSha256 = sha256Hex(requestBody);
  const signedHeaders = 'content-type;host;x-content-sha256;x-date';
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-content-sha256:${xContentSha256}`,
    `x-date:${xDate}`,
  ].join('\n');

  const canonicalRequest = [
    method,
    '/',
    query,
    canonicalHeaders,
    '',
    signedHeaders,
    xContentSha256,
  ].join('\n');

  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const credentialScope = `${shortXDate}/${region}/${service}/request`;
  const stringToSign = ['HMAC-SHA256', xDate, credentialScope, hashedCanonicalRequest].join('\n');

  const kDate = hmacRaw(secretAccessKey, shortXDate);
  const kRegion = hmacRaw(kDate, region);
  const kService = hmacRaw(kRegion, service);
  const kSigning = hmacRaw(kService, 'request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = [
    `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  const response = await fetch(`https://${host}/?${query}`, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'X-Content-Sha256': xContentSha256,
      'X-Date': xDate,
    },
    body: requestBody,
  });

  const payload = (await response.json()) as VolcengineResponse;
  if (!response.ok || payload.code !== 10000 || !payload.data?.binary_data_base64?.[0]) {
    throw new Error(payload.message || `Volcengine request failed with status ${response.status}`);
  }

  return payload.data.binary_data_base64[0];
}

async function generateImagesInBackground(
  generation: StoredGeneration,
  body: GenerateRequest,
  accessKeyId: string,
  secretAccessKey: string,
  reqKey: string,
) {
  const failedMessages: string[] = [];
  const plannedCount = body.candidatePlans?.length || body.generationCount;

  for (let index = 0; index < plannedCount; index += 1) {
    const candidatePlan = body.candidatePlans?.[index];

    try {
      const base64Image = await callVolcengine(accessKeyId, secretAccessKey, {
        req_key: reqKey,
        binary_data_base64:
          candidatePlan?.uploadedImages?.length ? candidatePlan.uploadedImages : body.uploadedImages,
        prompt: candidatePlan?.prompt?.trim() || body.finalPrompt,
        return_url: false,
        logo_info: {
          add_logo: true,
          logo_text_content: '\u5fbd\u7eb8\u827a\u5883',
        },
      });

      generation.result_images.push(`data:image/jpeg;base64,${base64Image}`);
    } catch (error) {
      generation.failed_count += 1;
      failedMessages.push(error instanceof Error ? error.message : String(error));
    }
  }

  generation.error_message =
    failedMessages.length > 0
      ? `${failedMessages.length} generation request(s) failed: ${failedMessages.join(' | ')}`
      : undefined;
  generation.status = generation.result_images.length > 0 ? 'completed' : 'failed';
}

function localGenerateApiPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '');
  const accessKeyId = env.VOLCENGINE_ACCESS_KEY_ID;
  const secretAccessKey = env.VOLCENGINE_SECRET_ACCESS_KEY;
  const reqKey = env.VOLCENGINE_REQ_KEY || 'byteedit_v2.0';

  return {
    name: 'local-generate-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://127.0.0.1');

        if (req.method === 'POST' && url.pathname === '/api/generate') {
          if (!accessKeyId || !secretAccessKey) {
            sendJson(res, 500, {
              error: 'VOLCENGINE_ACCESS_KEY_ID or VOLCENGINE_SECRET_ACCESS_KEY is missing',
            });
            return;
          }

          try {
            const rawBody = await readRequestBody(req);
            const body = JSON.parse(rawBody) as GenerateRequest;

            if (!body.finalPrompt?.trim()) {
              sendJson(res, 400, { error: 'finalPrompt is required' });
              return;
            }

            if (!Array.isArray(body.uploadedImages) || body.uploadedImages.length === 0) {
              sendJson(res, 400, { error: 'At least one uploaded image is required' });
              return;
            }

            const generationId = randomUUID();
            const plannedCount = body.candidatePlans?.length || body.generationCount;
            const generation: StoredGeneration = {
              id: generationId,
              created_at: new Date().toISOString(),
              uploaded_images: body.uploadedImages.map((_, index) => `image-${index}`),
              base_prompt: body.basePrompt,
              transform_prompt: body.transformPrompt,
              style_type: body.styleType,
              style_keywords: body.styleKeywords,
              ai_completion_enabled: body.aiCompletionEnabled,
              ai_completion_prompt: body.aiCompletionPrompt,
              final_prompt: body.finalPrompt,
              generation_count: plannedCount,
              status: 'processing',
              task_ids: [],
              result_images: [],
              failed_count: 0,
            };

            generationStore.set(generationId, generation);

            sendJson(res, 200, {
              success: true,
              generationId,
              taskIds: [],
            });

            void generateImagesInBackground(
              generation,
              body,
              accessKeyId,
              secretAccessKey,
              reqKey,
            ).catch((error) => {
              generation.failed_count = generation.generation_count;
              generation.status = 'failed';
              generation.error_message = error instanceof Error ? error.message : String(error);
            });

            return;
          } catch (error) {
            sendJson(res, 500, {
              error: error instanceof Error ? error.message : 'Generation failed',
            });
            return;
          }
        }

        if (req.method === 'GET' && /^\/api\/generations\/[^/]+\/status$/.test(url.pathname)) {
          const generationId = url.pathname.split('/')[3];
          const generation = generationStore.get(generationId);

          if (!generation) {
            sendJson(res, 404, { error: 'Generation not found' });
            return;
          }

          sendJson(res, 200, {
            status: generation.status,
            progress: getGenerationProgress(generation),
            resultImages: generation.result_images,
            errorMessage: generation.error_message,
            taskStatuses: [],
          });
          return;
        }

        if (req.method === 'GET' && /^\/api\/generations\/[^/]+$/.test(url.pathname)) {
          const generationId = url.pathname.split('/')[3];
          const generation = generationStore.get(generationId);

          if (!generation) {
            sendJson(res, 404, { error: 'Generation not found' });
            return;
          }

          sendJson(res, 200, generation);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    miaodaDevPlugin(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: 'named',
        namedExport: 'ReactComponent',
      },
    }),
    localGenerateApiPlugin(mode),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
