import { createHash, createHmac } from 'node:crypto';

interface VisualVolcengineResponse {
  code: number;
  message?: string;
  data?: {
    binary_data_base64?: string[];
  };
}

interface ArkImagesResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export type VolcengineConfig =
  | {
      provider: 'ark';
      apiKey: string;
      modelId: string;
      baseUrl: string;
      watermark: boolean;
    }
  | {
      provider: 'visual';
      accessKeyId: string;
      secretAccessKey: string;
      reqKey: string;
    };

const DEFAULT_ARK_MODEL_ID = 'doubao-seededit-3-0-i2i-250628';
const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

function sha256Hex(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

function hmacRaw(key: Buffer | string, content: string) {
  return createHmac('sha256', key).update(content).digest();
}

function toXDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getPreferredApiKey() {
  return process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
}

function normalizeArkBaseUrl(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function getArkErrorMessage(payload: ArkImagesResponse, status: number) {
  return (
    payload.error?.message ||
    payload.error?.code ||
    `Volcengine Ark request failed with status ${status}`
  );
}

function normalizeInputImage(image: string) {
  return image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
}

async function callArkImage(
  uploadedImages: string[],
  prompt: string,
  config: Extract<VolcengineConfig, { provider: 'ark' }>,
) {
  const primaryImage = uploadedImages.find((image) => typeof image === 'string' && image.length > 0);
  if (!primaryImage) {
    throw new Error('At least one uploaded image is required');
  }

  const response = await fetch(`${normalizeArkBaseUrl(config.baseUrl)}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelId,
      prompt,
      image: normalizeInputImage(primaryImage),
      size: 'adaptive',
      watermark: config.watermark,
      response_format: 'url',
    }),
  });

  const payload = (await response.json()) as ArkImagesResponse;
  const firstImage = payload.data?.[0];

  if (!response.ok || (!firstImage?.url && !firstImage?.b64_json)) {
    throw new Error(getArkErrorMessage(payload, response.status));
  }

  if (firstImage.b64_json) {
    return `data:image/png;base64,${firstImage.b64_json}`;
  }

  const imageResponse = await fetch(firstImage.url!);
  if (!imageResponse.ok) {
    throw new Error(`Generated image download failed with status ${imageResponse.status}`);
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function callVisualImage(
  uploadedImages: string[],
  prompt: string,
  config: Extract<VolcengineConfig, { provider: 'visual' }>,
) {
  const host = 'visual.volcengineapi.com';
  const service = 'cv';
  const version = '2022-08-31';
  const region = 'cn-north-1';
  const action = 'CVProcess';
  const contentType = 'application/json';
  const method = 'POST';
  const query = `Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(version)}`;
  const requestBody = JSON.stringify({
    req_key: config.reqKey,
    binary_data_base64: uploadedImages,
    prompt,
    return_url: false,
    logo_info: {
      add_logo: true,
      logo_text_content: '\u5fbd\u7eb8\u827a\u5883',
    },
  });

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

  const kDate = hmacRaw(config.secretAccessKey, shortXDate);
  const kRegion = hmacRaw(kDate, region);
  const kService = hmacRaw(kRegion, service);
  const kSigning = hmacRaw(kService, 'request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = [
    `HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
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

  const payload = (await response.json()) as VisualVolcengineResponse;
  if (!response.ok || payload.code !== 10000 || !payload.data?.binary_data_base64?.[0]) {
    throw new Error(payload.message || `Volcengine request failed with status ${response.status}`);
  }

  return `data:image/jpeg;base64,${payload.data.binary_data_base64[0]}`;
}

export function getVolcengineConfig(): VolcengineConfig {
  const apiKey = getPreferredApiKey();
  if (apiKey) {
    return {
      provider: 'ark',
      apiKey,
      modelId:
        process.env.VOLCENGINE_MODEL_ID ||
        process.env.ARK_MODEL_ID ||
        DEFAULT_ARK_MODEL_ID,
      baseUrl:
        process.env.VOLCENGINE_ARK_BASE_URL ||
        process.env.ARK_BASE_URL ||
        DEFAULT_ARK_BASE_URL,
      watermark: true,
    };
  }

  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
  const reqKey = process.env.VOLCENGINE_REQ_KEY || 'byteedit_v2.0';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'VOLCENGINE_API_KEY/ARK_API_KEY or VOLCENGINE_ACCESS_KEY_ID/VOLCENGINE_SECRET_ACCESS_KEY is missing',
    );
  }

  return {
    provider: 'visual',
    accessKeyId,
    secretAccessKey,
    reqKey,
  };
}

export async function callVolcengineImage(
  uploadedImages: string[],
  prompt: string,
  config: VolcengineConfig,
) {
  if (config.provider === 'ark') {
    return callArkImage(uploadedImages, prompt, config);
  }

  return callVisualImage(uploadedImages, prompt, config);
}
