import { createClient } from 'jsr:@supabase/supabase-js@2';

import { volcRequest } from '../_shared/volcengine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationRequest {
  uploadedImages: string[];
  basePrompt: string;
  transformPrompt: string;
  styleType: string;
  styleKeywords?: string;
  aiCompletionEnabled: boolean;
  aiCompletionPrompt?: string;
  finalPrompt: string;
  generationCount: number;
  candidatePlans?: Array<{
    prompt: string;
    uploadedImages: string[];
    variantLabel?: string;
  }>;
}

interface VolcGenerationResponse {
  code: number;
  message?: string;
  data?: {
    binary_data_base64?: string[];
  };
}

function decodeBase64Image(base64Image: string): Uint8Array {
  const binary = atob(base64Image);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function uploadBase64ImageToStorage(
  base64Image: string,
  bucketName: string,
  supabase: ReturnType<typeof createClient>,
) {
  const filePath = `uploads/${crypto.randomUUID()}.jpg`;
  const imageBytes = decodeBase64Image(base64Image);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, imageBytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function generateSingleImage(
  uploadedImages: string[],
  prompt: string,
  accessKeyId: string,
  secretAccessKey: string,
  reqKey: string,
) {
  const result = await volcRequest<VolcGenerationResponse>({
    accessKeyId,
    secretAccessKey,
    action: 'CVProcess',
    body: {
      req_key: reqKey,
      binary_data_base64: uploadedImages,
      prompt,
      return_url: false,
      logo_info: {
        add_logo: true,
        logo_text_content: '徽纸艺境',
      },
    },
  });

  const generatedImage = result.data?.binary_data_base64?.[0];
  if (result.code !== 10000 || !generatedImage) {
    throw new Error(result.message || 'Volcengine generation failed');
  }

  return generatedImage;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let generationId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessKeyId = Deno.env.get('VOLCENGINE_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('VOLCENGINE_SECRET_ACCESS_KEY');
    const reqKey = Deno.env.get('VOLCENGINE_REQ_KEY') ?? 'byteedit_v2.0';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('VOLCENGINE_ACCESS_KEY_ID or VOLCENGINE_SECRET_ACCESS_KEY not configured');
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    const body: GenerationRequest = await req.json();
    const finalPrompt = body.finalPrompt?.trim();
    const plannedCount = body.candidatePlans?.length || body.generationCount;

    if (!finalPrompt || plannedCount < 4 || plannedCount > 8) {
      return new Response(
        JSON.stringify({ error: 'Invalid generation request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!Array.isArray(body.uploadedImages) || body.uploadedImages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one uploaded image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: generation, error: insertError } = await supabase
      .from('generations')
      .insert({
        uploaded_images: body.uploadedImages.map((_, index) => `image-${index}`),
        base_prompt: body.basePrompt,
        transform_prompt: body.transformPrompt,
        style_type: body.styleType,
        style_keywords: body.styleKeywords,
        ai_completion_enabled: body.aiCompletionEnabled,
        ai_completion_prompt: body.aiCompletionPrompt,
        final_prompt: finalPrompt,
        generation_count: plannedCount,
        status: 'processing',
        task_ids: [],
        result_images: [],
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    generationId = generation.id;

    const generationTasks = Array.from({ length: plannedCount }, async (_, index) => {
      const candidatePlan = body.candidatePlans?.[index];
      const generatedImage = await generateSingleImage(
        candidatePlan?.uploadedImages?.length ? candidatePlan.uploadedImages : body.uploadedImages,
        candidatePlan?.prompt?.trim() || finalPrompt,
        accessKeyId,
        secretAccessKey,
        reqKey,
      );

      return uploadBase64ImageToStorage(generatedImage, 'generated-images', supabase!);
    });

    const settledResults = await Promise.allSettled(generationTasks);
    const resultImages = settledResults
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map((result) => result.value);
    const failedMessages = settledResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

    const status = resultImages.length > 0 ? 'completed' : 'failed';
    const errorMessage =
      failedMessages.length > 0
        ? `${failedMessages.length} generation request(s) failed: ${failedMessages.join(' | ')}`
        : null;

    await supabase
      .from('generations')
      .update({
        status,
        result_images: resultImages,
        error_message: errorMessage,
      })
      .eq('id', generationId);

    return new Response(
      JSON.stringify({
        success: true,
        generationId,
        taskIds: [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    if (supabase && generationId) {
      await supabase
        .from('generations')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', generationId);
    }

    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
