import type { Favorite, Generation, GenerationProgress, GenerationRequest } from '@/types';

const FAVORITES_STORAGE_KEY = 'hui-paper-art:favorites';

function getStoredFavorites(): Favorite[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse favorites from localStorage:', error);
    return [];
  }
}

function setStoredFavorites(favorites: Favorite[]) {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function submitGeneration(request: GenerationRequest) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return readJson<{ success: boolean; generationId: string; taskIds: string[] }>(response);
}

export async function checkGenerationStatus(generationId: string): Promise<GenerationProgress> {
  const response = await fetch(`/api/generations/${generationId}/status`);
  return readJson<GenerationProgress>(response);
}

export async function getGeneration(id: string): Promise<Generation | null> {
  const response = await fetch(`/api/generations/${id}`);

  if (response.status === 404) {
    return null;
  }

  return readJson<Generation>(response);
}

export async function getGenerations(): Promise<Generation[]> {
  return [];
}

export async function addFavorite(generationId: string, imageUrl: string) {
  const favorites = getStoredFavorites();
  const existing = favorites.find(
    (favorite) => favorite.generation_id === generationId && favorite.image_url === imageUrl,
  );

  if (existing) {
    return existing;
  }

  const favorite: Favorite = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    generation_id: generationId,
    image_url: imageUrl,
  };

  setStoredFavorites([favorite, ...favorites]);
  return favorite;
}

export async function removeFavorite(generationId: string, imageUrl: string) {
  const favorites = getStoredFavorites().filter(
    (favorite) => !(favorite.generation_id === generationId && favorite.image_url === imageUrl),
  );

  setStoredFavorites(favorites);
}

export async function getFavorites(generationId: string): Promise<Favorite[]> {
  return getStoredFavorites().filter((favorite) => favorite.generation_id === generationId);
}

export async function isFavorited(generationId: string, imageUrl: string): Promise<boolean> {
  return getStoredFavorites().some(
    (favorite) => favorite.generation_id === generationId && favorite.image_url === imageUrl,
  );
}
