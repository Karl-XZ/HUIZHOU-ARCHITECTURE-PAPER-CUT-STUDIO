import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageUpload } from '@/components/ImageUpload';
import { PromptConfig } from '@/components/PromptConfig';
import { StyleSelector, getStyleKeywords } from '@/components/StyleSelector';
import { GenerationControl } from '@/components/GenerationControl';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { submitGeneration } from '@/db/api';
import { filesToBase64Array, mergePrompts } from '@/lib/image-utils';
import type { GenerationRequest } from '@/types';

// 默认提示词
const DEFAULT_BASE_PROMPT = '徽派建筑，白墙黑瓦，马头墙，飞檐翘角，多层屋檐结构，传统中式建筑，真实光影';
const DEFAULT_TRANSFORM_PROMPT = '将建筑转化为二维平面构图，黑白刻纸风格，高对比度，剪影效果，线条清晰，保留建筑层次感与结构特征';
const DEFAULT_AI_COMPLETION_PROMPT = '补全不可见结构，保持徽派建筑风格一致，结构合理，对称性强，细节完整';

export default function HomePage() {
  const navigate = useNavigate();

  // 图片上传
  const [images, setImages] = useState<File[]>([]);

  // 提示词配置
  const [basePrompt, setBasePrompt] = useState(DEFAULT_BASE_PROMPT);
  const [transformPrompt, setTransformPrompt] = useState(DEFAULT_TRANSFORM_PROMPT);
  const [aiCompletionEnabled, setAiCompletionEnabled] = useState(false);
  const [aiCompletionPrompt, setAiCompletionPrompt] = useState(DEFAULT_AI_COMPLETION_PROMPT);

  // 风格选择
  const [styleType, setStyleType] = useState<'traditional' | 'modern' | 'custom'>('traditional');
  const [customStyleKeywords, setCustomStyleKeywords] = useState('');

  // 生成配置
  const [generationCount, setGenerationCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);

  // 自动启用 AI 补全（图片少于 2 张）
  useEffect(() => {
    if (images.length < 2 && images.length > 0) {
      setAiCompletionEnabled(true);
    }
  }, [images.length]);

  // 开始生成
  const handleGenerate = async () => {
    // 验证输入
    if (images.length === 0) {
      toast.error('请至少上传 1 张建筑照片');
      return;
    }

    if (!basePrompt.trim()) {
      toast.error('请输入基础提示词');
      return;
    }

    setIsGenerating(true);

    try {
      // 转换图片为 Base64
      toast.info('正在处理图片...');
      const base64Images = await filesToBase64Array(images);

      // 获取风格关键词
      const styleKeywords = getStyleKeywords(styleType, customStyleKeywords);

      // 合并提示词
      const finalPrompt = mergePrompts(
        basePrompt,
        transformPrompt,
        styleKeywords,
        aiCompletionEnabled,
        aiCompletionPrompt
      );

      // 构建请求
      const request: GenerationRequest = {
        uploadedImages: base64Images,
        basePrompt,
        transformPrompt,
        styleType,
        styleKeywords,
        aiCompletionEnabled,
        aiCompletionPrompt,
        finalPrompt,
        generationCount,
      };

      // 提交生成任务
      toast.info('正在提交生成任务...');
      const result = await submitGeneration(request);

      // 跳转到结果页
      navigate(`/result/${result.generationId}`);
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error(error instanceof Error ? error.message : '生成失败，请稍后重试');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold gradient-text">
              徽纸艺境
            </h1>
            <p className="text-lg text-muted-foreground">
              徽派建筑刻纸艺术生成系统
            </p>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              基于 AI 生图技术的「三维建筑转二维艺术表达」生成工具，专注于徽派建筑与金坛刻纸艺术的融合创新
            </p>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：示例参考 */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    示例参考
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    徽派建筑刻纸艺术效果展示
                  </p>
                </div>
                <div className="aspect-square rounded-lg overflow-hidden border-2 border-border">
                  <img
                    src="https://miaoda-conversation-file.cdn.bcebos.com/user-5vr5we1cxssg/20260317/file-abt93p19qvpc.jpg"
                    alt="徽派建筑刻纸艺术示例"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>✨ 将三维建筑转化为二维刻纸艺术</p>
                  <p>✨ 保留建筑层次感与结构特征</p>
                  <p>✨ 黑白对比，线条清晰</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 中间：配置区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 图片上传 */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                1. 上传建筑照片
              </h2>
              <ImageUpload images={images} onImagesChange={setImages} maxImages={10} />
            </section>

            <Separator />

            {/* 提示词配置 */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                2. 配置提示词
              </h2>
              <PromptConfig
                basePrompt={basePrompt}
                onBasePromptChange={setBasePrompt}
                transformPrompt={transformPrompt}
                onTransformPromptChange={setTransformPrompt}
                aiCompletionEnabled={aiCompletionEnabled}
                onAiCompletionEnabledChange={setAiCompletionEnabled}
                aiCompletionPrompt={aiCompletionPrompt}
                onAiCompletionPromptChange={setAiCompletionPrompt}
              />
            </section>

            <Separator />

            {/* 风格选择 */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                3. 选择风格
              </h2>
              <StyleSelector
                styleType={styleType}
                onStyleTypeChange={setStyleType}
                customStyleKeywords={customStyleKeywords}
                onCustomStyleKeywordsChange={setCustomStyleKeywords}
              />
            </section>

            <Separator />

            {/* 生成控制 */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                4. 开始生成
              </h2>
              <GenerationControl
                generationCount={generationCount}
                onGenerationCountChange={setGenerationCount}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                disabled={images.length === 0}
              />
            </section>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2026 徽纸艺境 - 徽派建筑刻纸艺术生成系统</p>
        </div>
      </footer>
    </div>
  );
}
