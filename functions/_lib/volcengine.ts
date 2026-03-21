import { getEnvString, type CloudflarePagesContext } from './runtime';

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

const encoder = new TextEncoder();
const DEFAULT_ARK_MODEL_ID = 'doubao-seededit-3-0-i2i-250628';
const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

function toHex(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256Hex(content: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  return toHex(digest);
}

async function hmacRaw(key: string | Uint8Array, content: string) {
  const rawKey = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(rawKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(content));
  return new Uint8Array(signature);
}

function toXDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getPreferredApiKey(context: CloudflarePagesContext) {
  return getEnvString(context, 'VOLCENGINE_API_KEY') || getEnvString(context, 'ARK_API_KEY');
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

async function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
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
  const base64 = await arrayBufferToBase64(await imageResponse.arrayBuffer());
  return `data:${contentType};base64,${base64}`;
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
  const xContentSha256 = await sha256Hex(requestBody);
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

  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const credentialScope = `${shortXDate}/${region}/${service}/request`;
  const stringToSign = ['HMAC-SHA256', xDate, credentialScope, hashedCanonicalRequest].join('\n');

  const kDate = await hmacRaw(config.secretAccessKey, shortXDate);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  const kSigning = await hmacRaw(kService, 'request');
  const signature = toHex(await hmacRaw(kSigning, stringToSign));
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

export function getVolcengineConfig(context: CloudflarePagesContext): VolcengineConfig {
  const apiKey = getPreferredApiKey(context);
  if (apiKey) {
    return {
      provider: 'ark',
      apiKey,
      modelId:
        getEnvString(context, 'VOLCENGINE_MODEL_ID') ||
        getEnvString(context, 'ARK_MODEL_ID') ||
        DEFAULT_ARK_MODEL_ID,
      baseUrl:
        getEnvString(context, 'VOLCENGINE_ARK_BASE_URL') ||
        getEnvString(context, 'ARK_BASE_URL') ||
        DEFAULT_ARK_BASE_URL,
      watermark: true,
    };
  }

  const accessKeyId = getEnvString(context, 'VOLCENGINE_ACCESS_KEY_ID');
  const secretAccessKey = getEnvString(context, 'VOLCENGINE_SECRET_ACCESS_KEY');
  const reqKey = getEnvString(context, 'VOLCENGINE_REQ_KEY') || 'byteedit_v2.0';

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
