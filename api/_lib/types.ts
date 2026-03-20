export interface CandidatePlan {
  prompt: string;
  uploadedImages: string[];
  variantLabel?: string;
}

export interface GenerateRequest {
  uploadedImages: string[];
  basePrompt: string;
  transformPrompt: string;
  styleType: string;
  styleKeywords?: string;
  aiCompletionEnabled: boolean;
  aiCompletionPrompt?: string;
  finalPrompt: string;
  generationCount: number;
  candidatePlans?: CandidatePlan[];
}

export interface StoredGeneration {
  id: string;
  created_at: string;
  uploaded_images: string[];
  base_prompt: string;
  transform_prompt: string;
  style_type: string;
  style_keywords?: string;
  ai_completion_enabled: boolean;
  ai_completion_prompt?: string;
  final_prompt: string;
  generation_count: number;
  status: 'processing' | 'completed' | 'failed';
  task_ids: string[];
  result_images: string[];
  failed_count: number;
  error_message?: string;
}

export interface StoredCandidateState {
  index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  variant_label?: string;
  image_key?: string;
  error?: string;
  updated_at: string;
}

export interface GenerationProgressPayload {
  status: 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    success: number;
    failed: number;
    pending: number;
  };
  resultImages: string[];
  errorMessage?: string;
  taskStatuses: [];
}
