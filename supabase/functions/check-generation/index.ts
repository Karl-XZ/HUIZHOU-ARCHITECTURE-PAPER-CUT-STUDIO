import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskStatus {
  taskId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  imageUrl?: string;
  error?: string;
}

/**
 * 将远程图片流式传输到 Supabase Storage
 */
async function streamImageToStorage(
  imageUrl: string,
  bucketName: string,
  supabase: any
) {
  try {
    // 验证 URL 格式
    try {
      new URL(imageUrl);
    } catch {
      throw new Error(`Invalid URL format: ${imageUrl}`);
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // 验证内容类型
    const isImage = contentType.startsWith('image/');
    const isOctetStream = contentType === 'application/octet-stream';

    if (!isImage && !isOctetStream) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const filePath = `uploads/${crypto.randomUUID()}.jpg`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, {
        contentType,
        cacheControl: 'no-cache',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      success: true,
      path: data.path,
      publicUrl: urlData.publicUrl,
      contentType,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
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

    const { generationId } = await req.json();

    if (!generationId) {
      return new Response(
        JSON.stringify({ error: '缺少 generationId 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取生成记录
    const { data: generation, error: fetchError } = await supabase
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (fetchError || !generation) {
      return new Response(
        JSON.stringify({ error: '生成记录不存在' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 如果已经完成或失败，直接返回
    if (generation.status === 'completed' || generation.status === 'failed') {
      return new Response(
        JSON.stringify({
          status: generation.status,
          resultImages: generation.result_images || [],
          errorMessage: generation.error_message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 查询所有任务状态
    const taskIds: string[] = generation.task_ids || [];
    const taskStatuses: TaskStatus[] = [];
    const queryUrl = 'https://app-abt9a9sz9gqp-api-VaOwP2jDmAga-gateway.appmiaoda.com/image-generation/task';

    for (const taskId of taskIds) {
      try {
        const response = await fetch(queryUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Authorization': `Bearer ${integrationKey}`,
          },
          body: JSON.stringify({ taskId }),
        });

        if (!response.ok) {
          taskStatuses.push({
            taskId,
            status: 'FAILED',
            error: `HTTP ${response.status}`,
          });
          continue;
        }

        const result = await response.json();
        if (result.status !== 0 || !result.data) {
          taskStatuses.push({
            taskId,
            status: 'FAILED',
            error: result.message || '查询失败',
          });
          continue;
        }

        const taskData = result.data;
        taskStatuses.push({
          taskId,
          status: taskData.status,
          imageUrl: taskData.result?.imageUrl,
          error: taskData.error?.message,
        });
      } catch (error) {
        taskStatuses.push({
          taskId,
          status: 'FAILED',
          error: error.message,
        });
      }
    }

    // 统计状态
    const successCount = taskStatuses.filter((t) => t.status === 'SUCCESS').length;
    const failedCount = taskStatuses.filter((t) => t.status === 'FAILED' || t.status === 'TIMEOUT').length;
    const pendingCount = taskStatuses.filter((t) => t.status === 'PENDING' || t.status === 'PROCESSING').length;

    // 如果所有任务都完成（成功或失败）
    if (pendingCount === 0) {
      const resultImages: string[] = [];

      // 转存成功的图片到 Supabase Storage
      for (const task of taskStatuses) {
        if (task.status === 'SUCCESS' && task.imageUrl) {
          const uploadResult = await streamImageToStorage(
            task.imageUrl,
            'generated-images',
            supabase
          );

          if (uploadResult.success) {
            resultImages.push(uploadResult.publicUrl);
          } else {
            console.error(`Failed to upload image for task ${task.taskId}:`, uploadResult.error);
          }
        }
      }

      // 更新数据库
      const finalStatus = resultImages.length > 0 ? 'completed' : 'failed';
      const errorMessage = failedCount > 0 ? `${failedCount} 个任务失败` : null;

      await supabase
        .from('generations')
        .update({
          status: finalStatus,
          result_images: resultImages,
          error_message: errorMessage,
        })
        .eq('id', generationId);

      return new Response(
        JSON.stringify({
          status: finalStatus,
          resultImages,
          errorMessage,
          taskStatuses,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 还有任务在处理中
    return new Response(
      JSON.stringify({
        status: 'processing',
        progress: {
          total: taskIds.length,
          success: successCount,
          failed: failedCount,
          pending: pendingCount,
        },
        taskStatuses,
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
