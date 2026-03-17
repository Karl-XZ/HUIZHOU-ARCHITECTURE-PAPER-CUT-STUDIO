import { supabase } from './supabase';
import type { Generation, Favorite, GenerationRequest, GenerationProgress } from '@/types';

/**
 * 提交图片生成任务
 */
export async function submitGeneration(request: GenerationRequest) {
  const { data, error } = await supabase.functions.invoke('submit-generation', {
    body: request,
  });

  if (error) {
    const errorMsg = await error?.context?.text?.();
    throw new Error(errorMsg || error?.message || '提交生成任务失败');
  }

  return data as { success: boolean; generationId: string; taskIds: string[] };
}

/**
 * 查询生成任务状态
 */
export async function checkGenerationStatus(generationId: string): Promise<GenerationProgress> {
  const { data, error } = await supabase.functions.invoke('check-generation', {
    body: { generationId },
  });

  if (error) {
    const errorMsg = await error?.context?.text?.();
    throw new Error(errorMsg || error?.message || '查询生成状态失败');
  }

  return data as GenerationProgress;
}

/**
 * 获取生成记录
 */
export async function getGeneration(id: string): Promise<Generation | null> {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * 获取生成记录列表
 */
export async function getGenerations(limit = 20, offset = 0): Promise<Generation[]> {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * 添加收藏
 */
export async function addFavorite(generationId: string, imageUrl: string) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      generation_id: generationId,
      image_url: imageUrl,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * 移除收藏
 */
export async function removeFavorite(generationId: string, imageUrl: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('generation_id', generationId)
    .eq('image_url', imageUrl);

  if (error) throw error;
}

/**
 * 获取收藏列表
 */
export async function getFavorites(generationId: string): Promise<Favorite[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('generation_id', generationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * 检查是否已收藏
 */
export async function isFavorited(generationId: string, imageUrl: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('generation_id', generationId)
    .eq('image_url', imageUrl)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
