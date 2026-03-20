import { getCache } from '@vercel/functions';

const TTL_SECONDS = 60 * 60 * 24 * 7;

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
  if (!process.env.VERCEL) {
    return null;
  }

  return getCache({
    namespace: 'hui-paper-art',
    namespaceSeparator: ':',
  });
}

export async function getStoreItem<T>(key: string): Promise<T | null> {
  const cache = getRuntimeCache();

  if (cache) {
    const value = await cache.get(key);
    return (value as T | null) ?? null;
  }

  const localValue = getLocalCache().get(key);
  return (localValue as T | undefined) ?? null;
}

export async function setStoreItem<T>(key: string, value: T, tags: string[] = []) {
  const cache = getRuntimeCache();

  if (cache) {
    await cache.set(key, value, {
      ttl: TTL_SECONDS,
      tags,
    });
    return;
  }

  getLocalCache().set(key, value);
}
