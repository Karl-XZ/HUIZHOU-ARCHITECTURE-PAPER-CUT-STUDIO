-- 创建生成记录表
CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 输入参数
  uploaded_images TEXT[], -- 上传的图片 URL 数组
  base_prompt TEXT NOT NULL, -- 基础提示词
  transform_prompt TEXT NOT NULL, -- 二维转化提示词
  style_type TEXT NOT NULL, -- 风格类型：traditional/modern/custom
  style_keywords TEXT, -- 风格关键词
  ai_completion_enabled BOOLEAN DEFAULT FALSE, -- 是否启用 AI 补全
  ai_completion_prompt TEXT, -- AI 补全提示词
  final_prompt TEXT NOT NULL, -- 最终合并的提示词
  
  -- 生成配置
  generation_count INTEGER DEFAULT 4, -- 生成数量 4-8
  
  -- 生成结果
  status TEXT DEFAULT 'pending', -- pending/processing/completed/failed
  task_ids TEXT[], -- 任务 ID 数组
  result_images TEXT[], -- 生成的图片 URL 数组
  error_message TEXT -- 错误信息
);

-- 创建收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  UNIQUE(generation_id, image_url)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_favorites_generation_id ON favorites(generation_id);

-- 创建存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true)
ON CONFLICT (id) DO NOTHING;

-- 设置表策略 - 允许所有人读写（无需登录）
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on generations" ON generations;
CREATE POLICY "Allow all operations on generations"
ON generations FOR ALL
TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on favorites" ON favorites;
CREATE POLICY "Allow all operations on favorites"
ON favorites FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 设置存储桶策略
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-images');

DROP POLICY IF EXISTS "Allow Upload" ON storage.objects;
CREATE POLICY "Allow Upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'generated-images');