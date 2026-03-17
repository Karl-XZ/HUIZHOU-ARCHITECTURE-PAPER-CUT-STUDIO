import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationRequest {
  uploadedImages: string[]; // Base64 图片数组
  basePrompt: string;
  transformPrompt: string;
  styleType: string;
  styleKeywords?: string;
  aiCompletionEnabled: boolean;
  aiCompletionPrompt?: string;
  finalPrompt: string;
  generationCount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const integrationKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!integrationKey) {
      throw new Error('INTEGRATIONS_API_KEY not configured');
    }

    const body: GenerationRequest = await req.json();

    // 验证输入
    if (!body.finalPrompt || body.generationCount < 4 || body.generationCount > 8) {
      return new Response(
        JSON.stringify({ error: '无效的请求参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建 API 请求内容
    const parts: any[] = [];

    // 添加图片
    if (body.uploadedImages && body.uploadedImages.length > 0) {
      for (const base64Image of body.uploadedImages) {
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image,
          },
        });
      }
    }

    // 添加提示词
    parts.push({
      text: body.finalPrompt,
    });

    // 提交多个任务
    const taskIds: string[] = [];
    const submitUrl = 'https://app-abt9a9sz9gqp-api-ra5EZDjVKkXa-gateway.appmiaoda.com/image-generation/submit';

    for (let i = 0; i < body.generationCount; i++) {
      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${integrationKey}`,
        },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Task ${i + 1} submission failed:`, errorText);
        throw new Error(`提交任务失败: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      if (result.status !== 0 || !result.data?.taskId) {
        throw new Error(`提交任务失败: ${result.message || '未知错误'}`);
      }

      taskIds.push(result.data.taskId);
    }

    // 保存到数据库
    const { data: generation, error: dbError } = await supabase
      .from('generations')
      .insert({
        uploaded_images: body.uploadedImages.map((_, i) => `image-${i}`), // 不存储完整 base64
        base_prompt: body.basePrompt,
        transform_prompt: body.transformPrompt,
        style_type: body.styleType,
        style_keywords: body.styleKeywords,
        ai_completion_enabled: body.aiCompletionEnabled,
        ai_completion_prompt: body.aiCompletionPrompt,
        final_prompt: body.finalPrompt,
        generation_count: body.generationCount,
        status: 'processing',
        task_ids: taskIds,
        result_images: [],
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`数据库错误: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        generationId: generation.id,
        taskIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '服务器错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
