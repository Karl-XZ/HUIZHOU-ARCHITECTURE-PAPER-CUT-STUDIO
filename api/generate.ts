import { enqueueBackgroundTask } from './_lib/background.ts';
import { createGeneration, runGeneration, validateGenerateRequest } from './_lib/generation-service.ts';
import { getVolcengineConfig } from './_lib/volcengine.ts';
import type { GenerateRequest } from './_lib/types.ts';

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
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      getVolcengineConfig();
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Server misconfigured' }, 500);
    }

    try {
      const body = (await request.json()) as GenerateRequest;
      const validationError = validateGenerateRequest(body);

      if (validationError) {
        return json({ error: validationError }, 400);
      }

      const { generationId } = await createGeneration(body);
      enqueueBackgroundTask(runGeneration(generationId, body));

      return json({
        success: true,
        generationId,
        taskIds: [],
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Generation failed' },
        500,
      );
    }
  },
};
