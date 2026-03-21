import { getEnvString, type CloudflarePagesContext } from './runtime';

interface VolcengineResponse {
  code: number;
  message?: string;
  data?: {
    binary_data_base64?: string[];
  };
}

const encoder = new TextEncoder();

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

export function getVolcengineConfig(context: CloudflarePagesContext) {
  const accessKeyId = getEnvString(context, 'VOLCENGINE_ACCESS_KEY_ID');
  const secretAccessKey = getEnvString(context, 'VOLCENGINE_SECRET_ACCESS_KEY');
  const reqKey = getEnvString(context, 'VOLCENGINE_REQ_KEY') || 'byteedit_v2.0';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('VOLCENGINE_ACCESS_KEY_ID or VOLCENGINE_SECRET_ACCESS_KEY is missing');
  }

  return {
    accessKeyId,
    secretAccessKey,
    reqKey,
  };
}

export async function callVolcengineImage(
  uploadedImages: string[],
  prompt: string,
  reqKey: string,
  accessKeyId: string,
  secretAccessKey: string,
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
    req_key: reqKey,
    binary_data_base64: uploadedImages,
    prompt,
    return_url: false,
    logo_info: {
      add_logo: true,
      logo_text_content: '徽纸艺境',
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

  const kDate = await hmacRaw(secretAccessKey, shortXDate);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  const kSigning = await hmacRaw(kService, 'request');
  const signature = toHex(await hmacRaw(kSigning, stringToSign));
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

  return `data:image/jpeg;base64,${payload.data.binary_data_base64[0]}`;
}
