import { getGenerationSnapshot } from '../../../_lib/generation-service';
import { json } from '../../../_lib/response';
import type { EdgeOneFunctionContext } from '../../../_lib/runtime';

export async function onRequestGet(context: EdgeOneFunctionContext) {
  const generationId = context.params?.id;

  if (!generationId) {
    return json({ error: 'Missing generation id' }, 400);
  }

  const snapshot = await getGenerationSnapshot(context, generationId);
  if (!snapshot) {
    return json({ error: 'Generation not found' }, 404);
  }

  return json(snapshot.progressPayload);
}
