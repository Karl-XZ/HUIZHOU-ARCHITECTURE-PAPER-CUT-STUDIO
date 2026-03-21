import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  Building2,
  Download,
  GalleryVerticalEnd,
  Loader2,
  ScrollText,
  Sparkles,
} from 'lucide-react';

import { GenerationControl } from '@/components/GenerationControl';
import { ImageUpload } from '@/components/ImageUpload';
import { PromptConfig } from '@/components/PromptConfig';
import { ResultGrid } from '@/components/ResultGrid';
import { StyleSelector, getStyleKeywords } from '@/components/StyleSelector';
import { Button } from '@/components/ui/button';
import {
  addFavorite,
  checkGenerationStatus,
  getFavorites,
  removeFavorite,
  submitGeneration,
} from '@/db/api';
import {
  buildCandidatePlans,
  downloadImage,
  downloadImagesAsZip,
  filesToBase64Array,
  mergePrompts,
} from '@/lib/image-utils';
import type { GenerationProgress, GenerationRequest } from '@/types';
import { toast } from 'sonner';

const DEFAULT_BASE_PROMPT =
  '徽派建筑场景，中国传统刻纸艺术风格，黑白剪纸效果，高对比度，正负形构成，镂空雕刻质感，细节精细，线条锐利干净，无灰度无渐变，建筑透视被平面化处理，层叠构图表现空间关系，像手工刻纸作品，画面简洁但细节丰富，纯黑底白图或白底黑图，正方构图';
const DEFAULT_TRANSFORM_PROMPT =
  '将建筑转化为二维平面构图，强化黑白刻纸语言、镂空关系和空间层次，保持建筑结构清晰、线条利落、画面纯净';
const DEFAULT_AI_COMPLETION_PROMPT =
  '在不改变徽派建筑主体识别度的前提下，补全被遮挡或缺失的结构，保持黑白刻纸构成的一致性与细节完整度';

const NAV_ITEMS = [
  { label: '风格首页', href: '#top' },
  { label: '视觉导引', href: '#overview' },
  { label: '创作工坊', href: '#workbench' },
  { label: '作品画廊', href: '#live-results' },
];

const FEATURE_CARDS = [
  {
    id: '01',
    title: '建筑采样',
    description: '上传不同角度的建筑素材，保留马头墙、天井院落与檐口细节的层次信息。',
    icon: Building2,
  },
  {
    id: '02',
    title: '语义刻画',
    description: '用提示词统一主体、刀感、黑白关系与空间秩序，让画面风格更稳定。',
    icon: ScrollText,
  },
  {
    id: '03',
    title: '候选成片',
    description: '候选图按生成顺序依次铺开，方便即时预览、筛选、收藏与下载。',
    icon: GalleryVerticalEnd,
  },
];

const HERO_METRICS = [
  { value: '黑白', label: '纯色剪纸表达' },
  { value: '方幅', label: '默认正方构图' },
  { value: '多图', label: '支持多角度输入' },
];

export default function HomePage() {
  const [images, setImages] = useState<File[]>([]);
  const [basePrompt, setBasePrompt] = useState(DEFAULT_BASE_PROMPT);
  const [transformPrompt, setTransformPrompt] = useState(DEFAULT_TRANSFORM_PROMPT);
  const [aiCompletionEnabled, setAiCompletionEnabled] = useState(false);
  const [aiCompletionPrompt, setAiCompletionPrompt] = useState(DEFAULT_AI_COMPLETION_PROMPT);
  const [styleType, setStyleType] = useState<'traditional' | 'modern' | 'custom'>('traditional');
  const [customStyleKeywords, setCustomStyleKeywords] = useState('');
  const [generationCount, setGenerationCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);
  const [activeGenerationCount, setActiveGenerationCount] = useState(0);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const notifiedStatusRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (images.length < 2 && images.length > 0) {
      setAiCompletionEnabled(true);
    }
  }, [images.length]);

  useEffect(() => {
    if (!activeGenerationId) {
      setFavorites(new Set());
      return;
    }

    const loadFavorites = async () => {
      try {
        const data = await getFavorites(activeGenerationId);
        setFavorites(new Set(data.map((favorite) => favorite.image_url)));
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }

    };

    void loadFavorites();
  }, [activeGenerationId]);

  useEffect(() => {
    if (!activeGenerationId) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollStatus = async () => {
      let nextStatus: GenerationProgress | null = null;

      try {
        const status = await checkGenerationStatus(activeGenerationId);
        if (cancelled) {
          return;
        }

        nextStatus = status;
        setGenerationProgress(status);

        if (status.status === 'completed' || status.status === 'failed') {
          setIsGenerating(false);

          const notificationKey = `${activeGenerationId}:${status.status}`;
          if (!notifiedStatusRef.current.has(notificationKey)) {
            notifiedStatusRef.current.add(notificationKey);

            if (status.status === 'completed') {
              toast.success(`已生成 ${status.resultImages?.length || 0} 张候选图`);
            } else {
              toast.error(status.errorMessage || '生成失败');
            }
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to check generation status:', error);
        setIsGenerating(false);
        toast.error('查询生成进度失败');

        return;
      }

      if (!cancelled && nextStatus?.status === 'processing') {
        timeoutId = setTimeout(() => {
          void pollStatus();
        }, 1500);
      }
    };

    void pollStatus();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeGenerationId]);

  useEffect(() => {
    if (!isGenerating && !generationProgress) {
      return;
    }

    const timer = window.setTimeout(() => {
      document.getElementById('live-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isGenerating, generationProgress, activeGenerationId]);

  const liveImages = generationProgress?.resultImages || [];
  const progressInfo = generationProgress?.progress || {
    total: activeGenerationCount,
    success: liveImages.length,
    failed: 0,
    pending: Math.max(activeGenerationCount - liveImages.length, 0),
  };
  const progressPercentage =
    progressInfo.total > 0
      ? Math.round(((progressInfo.success + progressInfo.failed) / progressInfo.total) * 100)
      : 0;
  const isLiveGenerating = isGenerating || generationProgress?.status === 'processing';
  const shouldShowLiveResults = isGenerating || generationProgress !== null;

  const handleGenerate = async () => {
    if (images.length === 0) {
      toast.error('请至少上传 1 张建筑照片');
      return;
    }

    if (!basePrompt.trim()) {
      toast.error('请输入基础提示词');
      return;
    }

    setIsGenerating(true);
    setActiveGenerationId(null);
    setActiveGenerationCount(generationCount);
    setGenerationProgress({
      status: 'processing',
      progress: {
        total: generationCount,
        success: 0,
        failed: 0,
        pending: generationCount,
      },
      resultImages: [],
      taskStatuses: [],
    });
    setFavorites(new Set());

    try {
      toast.info('正在处理图片...');
      const base64Images = await filesToBase64Array(images);

      const styleKeywords = getStyleKeywords(styleType, customStyleKeywords);
      const finalPrompt = mergePrompts(
        basePrompt,
        transformPrompt,
        styleKeywords,
        aiCompletionEnabled,
        aiCompletionPrompt,
      );
      const candidatePlans = buildCandidatePlans(base64Images, finalPrompt, generationCount);

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
        candidatePlans,
      };

      toast.info('正在提交生成任务...');
      const result = await submitGeneration(request);
      setActiveGenerationId(result.generationId);
      toast.success('候选图开始生成');
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error(error instanceof Error ? error.message : '生成失败，请稍后重试');
      setIsGenerating(false);
      setActiveGenerationCount(0);
      setGenerationProgress(null);
    }
  };

  const handleToggleFavorite = async (imageUrl: string) => {
    if (!activeGenerationId) {
      return;
    }

    try {
      if (favorites.has(imageUrl)) {
        await removeFavorite(activeGenerationId, imageUrl);
        setFavorites((previous) => {
          const next = new Set(previous);
          next.delete(imageUrl);
          return next;
        });
        toast.success('已取消收藏');
      } else {
        await addFavorite(activeGenerationId, imageUrl);
        setFavorites((previous) => new Set(previous).add(imageUrl));
        toast.success('已加入收藏');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast.error('收藏操作失败');
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      await downloadImage(imageUrl);
      toast.success('下载成功');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('下载失败');
    }
  };

  const handleBatchDownload = async () => {
    if (liveImages.length === 0) {
      toast.error('还没有可下载的候选图');
      return;
    }

    setIsDownloading(true);
    try {
      await downloadImagesAsZip(liveImages, 'hui-paper-art');
      toast.success('批量下载完成');
    } catch (error) {
      console.error('Batch download failed:', error);
      toast.error('批量下载失败');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="hui-page" id="top">
      <div className="hui-shell">
        <header className="hui-topbar">
          <div className="hui-brand">
            <span className="hui-brand-mark">徽</span>
            <div className="hui-brand-copy">
              <h1 className="hui-brand-title">徽纸艺境</h1>
              <p className="hui-brand-subtitle">徽派建筑刻纸艺术生成系统</p>
            </div>
          </div>

          <nav className="hui-nav" aria-label="页面导航">
            {NAV_ITEMS.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <a href="#workbench" className="hui-button-secondary hui-topbar-cta">
            进入工坊
          </a>
        </header>

        <main>
          <section className="hui-hero" id="hero">
            <div className="hui-hero-grid">
              <div className="hui-hero-media">
                <img src="/images/example-generated.jpg" alt="徽派建筑刻纸示例" />
                <div className="hui-hero-badge">示例成片 / 黑白剪纸语言</div>
              </div>

              <div className="hui-hero-copy">
                <p className="hui-kicker">Huizhou Architecture Paper-Cut Studio</p>
                <h2 className="hui-hero-title">徽纸艺境</h2>
                <p className="hui-hero-subtitle">让白墙黛瓦转译成刀锋分明的刻纸图像</p>
                <div className="hui-hero-divider" />
                <p className="hui-hero-description">
                  徽派建筑的轮廓、院落的层层递进与飞檐的轻重起伏，在这里会被压缩成纯黑白、
                  强对比、富有镂空节奏的刻纸画面。上传素材、设定语义，再从一组候选成片里挑出最贴近心意的一张。
                </p>

                <div className="hui-hero-actions">
                  <a href="#workbench" className="hui-button-primary">
                    <Sparkles className="h-4 w-4" />
                    立即创作
                    <ArrowDown className="h-4 w-4" />
                  </a>

                  <div className="hui-metrics">
                    {HERO_METRICS.map((metric) => (
                      <div key={metric.label} className="hui-metric">
                        <strong>{metric.value}</strong>
                        <span>{metric.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="hui-hero-wave" />
          </section>

          <section className="hui-paper-panel hui-overview" id="overview">
            <div>
              <p className="hui-section-lead">徽州村落 / 马头墙 / 天井院落</p>
              <h2 className="hui-section-title">
                以建筑层叠轮廓为骨，以黑白正负形为意，生成具有传统气息的刻纸图像
              </h2>
              <p className="hui-section-description">
                画面强调构图秩序、镂空节奏与建筑识别度。你可以从基础提示词、转化提示词、
                风格倾向与 AI 补全规则四个部分控制结果，让同一组建筑素材呈现出不同的刻纸气质。
              </p>

              <div className="hui-highlight-grid">
                {FEATURE_CARDS.map((card) => {
                  const Icon = card.icon;

                  return (
                    <article key={card.id} className="hui-highlight">
                      <Icon className="hui-highlight-icon" />
                      <span className="hui-highlight-number">{card.id}</span>
                      <h3 className="hui-highlight-title">{card.title}</h3>
                      <p>{card.description}</p>
                    </article>
                  );
                })}
              </div>

              <div className="hui-inline-actions">
                <a href="#workbench" className="hui-button-primary">
                  开始创作
                </a>
                <p className="hui-inline-note">
                  建议同时上传正立面、斜角与局部细节，多图输入时更容易保留建筑层次与空间关系。
                </p>
              </div>
            </div>

            <div className="hui-showcase">
              <div className="hui-frame">
                <img
                  src="/images/example-generated-alt.jpg"
                  alt="徽派建筑刻纸艺术作品展示"
                />
              </div>
              <div className="hui-frame-tag">
                <span className="hui-tag">示例成片 / 候选作品展示</span>
              </div>
            </div>
          </section>

          <section className="hui-paper-panel hui-workbench" id="workbench">
            <div className="hui-section-head">
              <div>
                <p className="hui-section-lead">创作工坊</p>
                <h2 className="hui-section-title">上传素材、设定语义与风格，组织你自己的候选画廊</h2>
              </div>
              <div className="hui-side-note">
                每轮任务都会依照当前配置生成多张候选图，适合比较构图、黑白关系与细节取舍。
              </div>
            </div>

            <div className="hui-workbench-grid">
              <section className="hui-stage">
                <div className="hui-stage-head">
                  <div>
                    <h3 className="hui-stage-title">上传建筑照片</h3>
                    <p className="hui-stage-desc">
                      支持多张 JPG、PNG。不同视角越充分，模型越容易保留建筑的轮廓起伏与院落层次。
                    </p>
                  </div>
                  <span className="hui-stage-index">壹</span>
                </div>
                <ImageUpload images={images} onImagesChange={setImages} maxImages={10} />
              </section>

              <section className="hui-stage">
                <div className="hui-stage-head">
                  <div>
                    <h3 className="hui-stage-title">配置提示词</h3>
                    <p className="hui-stage-desc">
                      用基础提示词描述主体，用转化提示词控制平面化语言，再决定是否启用 AI 补全。
                    </p>
                  </div>
                  <span className="hui-stage-index">贰</span>
                </div>
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

              <section className="hui-stage">
                <div className="hui-stage-head">
                  <div>
                    <h3 className="hui-stage-title">选择风格倾向</h3>
                    <p className="hui-stage-desc">
                      传统风格强调纹样与对称，现代风格强调块面与留白，自定义风格则完全开放关键词。
                    </p>
                  </div>
                  <span className="hui-stage-index">叁</span>
                </div>
                <StyleSelector
                  styleType={styleType}
                  onStyleTypeChange={setStyleType}
                  customStyleKeywords={customStyleKeywords}
                  onCustomStyleKeywordsChange={setCustomStyleKeywords}
                />
              </section>

              <section className="hui-stage">
                <div className="hui-stage-head">
                  <div>
                    <h3 className="hui-stage-title">开始生成候选图</h3>
                    <p className="hui-stage-desc">
                      设置输出数量后即可开始生成，候选图会按完成顺序呈现在下方画廊区域。
                    </p>
                  </div>
                  <span className="hui-stage-index">肆</span>
                </div>
                <GenerationControl
                  generationCount={generationCount}
                  onGenerationCountChange={setGenerationCount}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  disabled={images.length === 0}
                />
              </section>
            </div>
          </section>

          {shouldShowLiveResults && (
            <section className="hui-paper-panel hui-gallery-panel" id="live-results">
              <div className="hui-gallery-header">
                <div>
                  <p className="hui-section-lead">候选画廊</p>
                  <h2 className="hui-section-title">本轮任务的候选图会依次铺开</h2>
                  <p className="hui-card-desc">
                    {activeGenerationId
                      ? '画廊会随着任务进度持续更新，已完成的候选图将即时显示。'
                      : '图片正在整理与提交，请稍候片刻。'}
                  </p>
                </div>

                <div className="hui-result-actions">
                  {activeGenerationId && (
                    <span className="hui-meta-chip">任务编号 {activeGenerationId.slice(0, 8)}</span>
                  )}
                  <span className="hui-meta-chip">
                    已完成 {progressInfo.success} / {progressInfo.total}
                  </span>
                  <Button
                    className="hui-button-primary"
                    onClick={handleBatchDownload}
                    disabled={liveImages.length === 0 || isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        下载中...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        批量下载
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <section className="hui-progress-panel">
                <div>
                  <h3 className="hui-card-title">
                    {isLiveGenerating ? '正在生成中' : '本轮生成已完成'}
                  </h3>
                  <p className="hui-card-desc">
                    {progressInfo.total > 0 && (
                      <>
                        成功 {progressInfo.success} 张，失败 {progressInfo.failed} 张，剩余 {progressInfo.pending} 张
                      </>
                    )}
                  </p>
                  {generationProgress?.errorMessage && (
                    <p className="hui-hint mt-3">{generationProgress.errorMessage}</p>
                  )}
                </div>

                <div className="hui-progress-head">
                  <div className="hui-hint">
                    进度会自动刷新。每完成一张候选图，画廊里的占位卡片就会被真实结果替换。
                  </div>
                  <div className="hui-progress-value">{progressPercentage}%</div>
                </div>

                <div className="hui-progress-bar">
                  <span style={{ width: `${progressPercentage}%` }} />
                </div>
              </section>

              <ResultGrid
                images={liveImages}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onDownload={handleDownload}
                isLoading={!activeGenerationId && isGenerating}
                isGenerating={isLiveGenerating}
                expectedCount={progressInfo.total || activeGenerationCount}
              />
            </section>
          )}
        </main>

        <footer className="hui-footer">
          <p>
            <strong>徽纸艺境</strong> 以徽派建筑为母题，将白墙黛瓦转译为黑白刻纸图像。
          </p>
          <p>徽纸艺境</p>
        </footer>
      </div>
    </div>
  );
}
