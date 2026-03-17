export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// 生成记录类型
export interface Generation {
  id: string;
  created_at: string;
  uploaded_images: string[];
  base_prompt: string;
  transform_prompt: string;
  style_type: 'traditional' | 'modern' | 'custom';
  style_keywords?: string;
  ai_completion_enabled: boolean;
  ai_completion_prompt?: string;
  final_prompt: string;
  generation_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  task_ids: string[];
  result_images: string[];
  error_message?: string;
}

// 收藏类型
export interface Favorite {
  id: string;
  created_at: string;
  generation_id: string;
  image_url: string;
}

// 生成请求类型
export interface GenerationRequest {
  uploadedImages: string[];
  basePrompt: string;
  transformPrompt: string;
  styleType: 'traditional' | 'modern' | 'custom';
  styleKeywords?: string;
  aiCompletionEnabled: boolean;
  aiCompletionPrompt?: string;
  finalPrompt: string;
  generationCount: number;
}

// 任务状态类型
export interface TaskStatus {
  taskId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  imageUrl?: string;
  error?: string;
}

// 生成进度类型
export interface GenerationProgress {
  status: 'processing' | 'completed' | 'failed';
  progress?: {
    total: number;
    success: number;
    failed: number;
    pending: number;
  };
  resultImages?: string[];
  errorMessage?: string;
  taskStatuses?: TaskStatus[];
}
