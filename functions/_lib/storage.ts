import {
  getBinding,
  type CloudflareKvNamespace,
  type CloudflarePagesContext,
} from './runtime';

const CACHE_PREFIX = 'hui_paper_art_';

type LocalCacheMap = Map<string, string>;

function getLocalCache() {
  const scope = globalThis as typeof globalThis & {
    __huiPaperArtCloudflareCache__?: LocalCacheMap;
  };

  if (!scope.__huiPaperArtCloudflareCache__) {
    scope.__huiPaperArtCloudflareCache__ = new Map<string, string>();
  }

  return scope.__huiPaperArtCloudflareCache__;
}

function normalizeKey(key: string) {
  return `${CACHE_PREFIX}${key}`.replace(/[^A-Za-z0-9_]/g, '_');
}

function getKvNamespace(context: CloudflarePagesContext) {
  return getBinding<CloudflareKvNamespace>(context, 'HUI_PAPER_ART_KV');
}

export async function getStoreText(
  context: CloudflarePagesContext,
  key: string,
): Promise<string | null> {
  const normalizedKey = normalizeKey(key);
  const kv = getKvNamespace(context);

  if (kv) {
    try {
      const value = await kv.get(normalizedKey);
      return typeof value === 'string' ? value : null;
    } catch (error) {
      console.error('Failed to read from Cloudflare KV:', error);
    }
  }

  return getLocalCache().get(normalizedKey) ?? null;
}

export async function getStoreJson<T>(
  context: CloudflarePagesContext,
  key: string,
): Promise<T | null> {
  const raw = await getStoreText(context, key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Failed to parse cached JSON:', error);
    return null;
  }
}

export async function setStoreText(
  context: CloudflarePagesContext,
  key: string,
  value: string,
) {
  const normalizedKey = normalizeKey(key);
  const kv = getKvNamespace(context);

  if (kv) {
    try {
      await kv.put(normalizedKey, value);
      return;
    } catch (error) {
      console.error('Failed to write to Cloudflare KV:', error);
    }
  }

  getLocalCache().set(normalizedKey, value);
}

export async function setStoreJson<T>(
  context: CloudflarePagesContext,
  key: string,
  value: T,
) {
  await setStoreText(context, key, JSON.stringify(value));
}
