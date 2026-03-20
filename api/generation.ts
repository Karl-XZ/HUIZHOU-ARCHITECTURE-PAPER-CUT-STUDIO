import { getGenerationResponse } from './_lib/generation-service.ts';

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const generationId = url.searchParams.get('id');

    if (!generationId) {
      return json({ error: 'Generation id is required' }, 400);
    }

    const generation = await getGenerationResponse(generationId);
    if (!generation) {
      return json({ error: 'Generation not found' }, 404);
    }

    return json(generation);
  },
};
