import { randomUUID } from 'node:crypto';

import { getStoreItem, setStoreItem } from './runtime-store.js';
import { callVolcengineImage, getVolcengineConfig } from './volcengine.js';
import type {
  CandidatePlan,
  GenerateRequest,
  GenerationProgressPayload,
  StoredCandidateState,
  StoredGeneration,
} from './types.js';

function generationKey(id: string) {
  return `generation:${id}:meta`;
}

function candidateKey(id: string, index: number) {
  return `generation:${id}:candidate:${index}`;
}

function imageKey(id: string, index: number) {
  return `generation:${id}:image:${index}`;
}

function generationTag(id: string) {
  return `generation:${id}`;
}

function resolveCandidateUploadedImages(uploadedImages: string[], imageIndexes?: number[]) {
  if (!Array.isArray(imageIndexes) || imageIndexes.length === 0) {
    return uploadedImages;
  }

  const resolvedImages = imageIndexes
    .map((index) => uploadedImages[index])
    .filter((image): image is string => typeof image === 'string' && image.length > 0);

  return resolvedImages.length > 0 ? resolvedImages : uploadedImages;
}

function getPlannedCandidates(body: GenerateRequest): CandidatePlan[] {
  if (Array.isArray(body.candidatePlans) && body.candidatePlans.length > 0) {
    return body.candidatePlans.map((plan) => ({
      prompt: plan.prompt?.trim() || body.finalPrompt,
      imageIndexes: plan.imageIndexes,
      variantLabel: plan.variantLabel,
    }));
  }

  return Array.from({ length: body.generationCount }, () => ({
    prompt: body.finalPrompt,
  }));
}

async function listCandidateStates(id: string, count: number) {
  const states = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      getStoreItem<StoredCandidateState>(candidateKey(id, index)),
    ),
  );

  return states.filter((state): state is StoredCandidateState => state !== null);
}

async function setCandidateState(
  generationId: string,
  index: number,
  state: StoredCandidateState,
) {
  await setStoreItem(candidateKey(generationId, index), state, [generationTag(generationId)]);
}

export function validateGenerateRequest(body: GenerateRequest) {
  if (!body.finalPrompt?.trim()) {
    return 'finalPrompt is required';
  }

  if (!Array.isArray(body.uploadedImages) || body.uploadedImages.length === 0) {
    return 'At least one uploaded image is required';
  }

  const plannedCount = getPlannedCandidates(body).length;
  if (plannedCount < 4 || plannedCount > 8) {
    return 'generationCount must be between 4 and 8';
  }

  return null;
}

export async function createGeneration(body: GenerateRequest) {
  const generationId = randomUUID();
  const plannedCandidates = getPlannedCandidates(body);
  const generation: StoredGeneration = {
    id: generationId,
    created_at: new Date().toISOString(),
    uploaded_images: body.uploadedImages.map((_, index) => `image-${index}`),
    base_prompt: body.basePrompt,
    transform_prompt: body.transformPrompt,
    style_type: body.styleType,
    style_keywords: body.styleKeywords,
    ai_completion_enabled: body.aiCompletionEnabled,
    ai_completion_prompt: body.aiCompletionPrompt,
    final_prompt: body.finalPrompt,
    generation_count: plannedCandidates.length,
    status: 'processing',
    task_ids: [],
    result_images: [],
    failed_count: 0,
  };

  await setStoreItem(generationKey(generationId), generation, [generationTag(generationId)]);
  await Promise.all(
    plannedCandidates.map((candidate, index) =>
      setCandidateState(generationId, index, {
        index,
        status: 'pending',
        variant_label: candidate.variantLabel,
        updated_at: new Date().toISOString(),
      }),
    ),
  );

  return {
    generationId,
    generation,
    plannedCandidates,
  };
}

async function generateSingleCandidate(
  generationId: string,
  candidate: CandidatePlan,
  index: number,
  uploadedImages: string[],
  config: ReturnType<typeof getVolcengineConfig>,
) {
  await setCandidateState(generationId, index, {
    index,
    status: 'processing',
    variant_label: candidate.variantLabel,
    updated_at: new Date().toISOString(),
  });

  try {
    const resultImage = await callVolcengineImage(
      resolveCandidateUploadedImages(uploadedImages, candidate.imageIndexes),
      candidate.prompt,
      config,
    );

    const storedImageKey = imageKey(generationId, index);
    await setStoreItem(storedImageKey, resultImage, [generationTag(generationId)]);
    await setCandidateState(generationId, index, {
      index,
      status: 'completed',
      variant_label: candidate.variantLabel,
      image_key: storedImageKey,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    await setCandidateState(generationId, index, {
      index,
      status: 'failed',
      variant_label: candidate.variantLabel,
      error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    });
  }
}

export async function runGeneration(generationId: string, body: GenerateRequest) {
  const config = getVolcengineConfig();
  const plannedCandidates = getPlannedCandidates(body);

  await Promise.allSettled(
    plannedCandidates.map((candidate, index) =>
      generateSingleCandidate(generationId, candidate, index, body.uploadedImages, config),
    ),
  );
}

export async function getGenerationSnapshot(generationId: string): Promise<{
  generation: StoredGeneration;
  candidateStates: StoredCandidateState[];
  progressPayload: GenerationProgressPayload;
} | null> {
  const generation = await getStoreItem<StoredGeneration>(generationKey(generationId));
  if (!generation) {
    return null;
  }

  const candidateStates = await listCandidateStates(generationId, generation.generation_count);
  const successStates = candidateStates.filter((state) => state.status === 'completed');
  const failedStates = candidateStates.filter((state) => state.status === 'failed');
  const resultImages = (
    await Promise.all(
      successStates
        .filter((state) => state.image_key)
        .map(async (state) => ({
          index: state.index,
          image: await getStoreItem<string>(state.image_key!),
        })),
    )
  )
    .filter((item): item is { index: number; image: string } => typeof item.image === 'string')
    .sort((left, right) => left.index - right.index)
    .map((item) => item.image);

  const progress = {
    total: generation.generation_count,
    success: successStates.length,
    failed: failedStates.length,
    pending: Math.max(generation.generation_count - successStates.length - failedStates.length, 0),
  };

  const errorMessage =
    failedStates.length > 0
      ? `${failedStates.length} generation request(s) failed: ${failedStates
          .map((state) => state.error)
          .filter(Boolean)
          .join(' | ')}`
      : undefined;

  const status =
    progress.pending > 0 ? 'processing' : progress.success > 0 ? 'completed' : 'failed';

  return {
    generation,
    candidateStates,
    progressPayload: {
      status,
      progress,
      resultImages,
      errorMessage,
      taskStatuses: [],
    },
  };
}

export async function getGenerationResponse(generationId: string) {
  const snapshot = await getGenerationSnapshot(generationId);
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot.generation,
    status: snapshot.progressPayload.status,
    result_images: snapshot.progressPayload.resultImages,
    failed_count: snapshot.progressPayload.progress.failed,
    error_message: snapshot.progressPayload.errorMessage,
  };
}
