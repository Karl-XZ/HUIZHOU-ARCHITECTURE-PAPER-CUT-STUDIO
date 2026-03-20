import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { generationId } = await req.json();

    if (!generationId) {
      return new Response(
        JSON.stringify({ error: 'Missing generationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: generation, error } = await supabase
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (error || !generation) {
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (generation.status === 'completed' || generation.status === 'failed') {
      return new Response(
        JSON.stringify({
          status: generation.status,
          resultImages: generation.result_images || [],
          errorMessage: generation.error_message,
          taskStatuses: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const completedCount = Array.isArray(generation.result_images) ? generation.result_images.length : 0;
    const totalCount = generation.generation_count ?? 0;
    const pendingCount = Math.max(totalCount - completedCount, 0);

    return new Response(
      JSON.stringify({
        status: 'processing',
        progress: {
          total: totalCount,
          success: completedCount,
          failed: 0,
          pending: pendingCount,
        },
        taskStatuses: [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
