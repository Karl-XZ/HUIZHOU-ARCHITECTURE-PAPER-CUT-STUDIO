import { getCache } from '@vercel/functions';

const TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_PREFIX = 'hui-paper-art:';

type LocalCacheMap = Map<string, unknown>;

function getLocalCache() {
  const scope = globalThis as typeof globalThis & {
    __huiPaperArtCache__?: LocalCacheMap;
  };

  if (!scope.__huiPaperArtCache__) {
    scope.__huiPaperArtCache__ = new Map<string, unknown>();
  }

  return scope.__huiPaperArtCache__;
}

function getRuntimeCache() {
  try {
    if (!process.env.VERCEL) {
      return null;
    }

    return getCache();
  } catch (error) {
    console.error('Failed to initialize Vercel Runtime Cache:', error);
    return null;
  }
}

function toCacheKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export async function getStoreItem<T>(key: string): Promise<T | null> {
  const cache = getRuntimeCache();

  if (cache) {
    try {
      const value = await cache.get(toCacheKey(key));
      return (value as T | null) ?? null;
    } catch (error) {
      console.error('Failed to read from Vercel Runtime Cache:', error);
    }
  }

  const localValue = getLocalCache().get(key);
  return (localValue as T | undefined) ?? null;
}

export async function setStoreItem<T>(key: string, value: T, tags: string[] = []) {
  const cache = getRuntimeCache();

  if (cache) {
    try {
      await cache.set(toCacheKey(key), value, {
        ttl: TTL_SECONDS,
        tags,
      });
      return;
    } catch (error) {
      console.error('Failed to write to Vercel Runtime Cache:', error);
    }
  }

  getLocalCache().set(key, value);
}
