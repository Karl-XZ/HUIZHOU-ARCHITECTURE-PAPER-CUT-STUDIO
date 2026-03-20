const encoder = new TextEncoder();

interface VolcRequestOptions {
  service?: string;
  version?: string;
  region?: string;
  host?: string;
  contentType?: string;
  method?: 'POST' | 'GET';
}

interface VolcRequestArgs {
  accessKeyId: string;
  secretAccessKey: string;
  action: string;
  body: Record<string, unknown> | string;
  options?: VolcRequestOptions;
}

function toHex(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toAmzDate(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/[:-]|\.\d{3}/g, '');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toHex(digest);
}

async function hmacSha256Raw(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)));
}

async function hmacSha256Hex(key: Uint8Array, value: string): Promise<string> {
  return toHex(await hmacSha256Raw(key, value));
}

function buildSortedQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export async function volcRequest<T>({
  accessKeyId,
  secretAccessKey,
  action,
  body,
  options = {},
}: VolcRequestArgs): Promise<T> {
  const service = options.service ?? 'cv';
  const version = options.version ?? '2022-08-31';
  const region = options.region ?? 'cn-north-1';
  const host = options.host ?? 'visual.volcengineapi.com';
  const contentType = options.contentType ?? 'application/json';
  const method = options.method ?? 'POST';

  const query = buildSortedQuery({
    Action: action,
    Version: version,
  });

  const requestBody = typeof body === 'string' ? body : JSON.stringify(body);
  const xDate = toAmzDate(new Date());
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

  const kDate = await hmacSha256Raw(encoder.encode(secretAccessKey), shortXDate);
  const kRegion = await hmacSha256Raw(kDate, region);
  const kService = await hmacSha256Raw(kRegion, service);
  const kSigning = await hmacSha256Raw(kService, 'request');
  const signature = await hmacSha256Hex(kSigning, stringToSign);

  const authorization = [
    `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  const response = await fetch(`https://${host}/?${query}`, {
    method,
    headers: {
      'Authorization': authorization,
      'Content-Type': contentType,
      'X-Content-Sha256': xContentSha256,
      'X-Date': xDate,
    },
    body: method === 'POST' ? requestBody : undefined,
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : `Volcengine request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
