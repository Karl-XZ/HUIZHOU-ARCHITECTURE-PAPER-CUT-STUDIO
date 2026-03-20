import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResultGrid } from '@/components/ResultGrid';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { checkGenerationStatus, getGeneration, addFavorite, removeFavorite, getFavorites } from '@/db/api';
import { downloadImage, downloadImagesAsZip } from '@/lib/image-utils';
import type { Generation, GenerationProgress } from '@/types';

export default function ResultPage() {
  const { generationId } = useParams<{ generationId: string }>();
  const navigate = useNavigate();

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isPolling, setIsPolling] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // 加载生成记录
  useEffect(() => {
    if (!generationId) return;

    const loadGeneration = async () => {
      try {
        const data = await getGeneration(generationId);
        if (data) {
          setGeneration(data);
        }
      } catch (error) {
        console.error('Failed to load generation:', error);
        toast.error('加载生成记录失败');
      }
    };

    loadGeneration();
  }, [generationId]);

  // 加载收藏列表
  useEffect(() => {
    if (!generationId) return;

    const loadFavorites = async () => {
      try {
        const data = await getFavorites(generationId);
        setFavorites(new Set(data.map((f) => f.image_url)));
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    };

    loadFavorites();
  }, [generationId]);

  // 轮询生成状态
  useEffect(() => {
    if (!generationId || !isPolling) return;

    const pollStatus = async () => {
      try {
        const status = await checkGenerationStatus(generationId);
        setProgress(status);

        // 如果完成或失败，停止轮询
        if (status.status === 'completed' || status.status === 'failed') {
          setIsPolling(false);

          // 重新加载生成记录
          const data = await getGeneration(generationId);
          if (data) {
            setGeneration(data);
          }

          if (status.status === 'completed') {
            toast.success(`成功生成 ${status.resultImages?.length || 0} 张图片！`);
          } else {
            toast.error(status.errorMessage || '生成失败');
          }
        }
      } catch (error) {
        console.error('Failed to check status:', error);
        toast.error('查询生成状态失败');
        setIsPolling(false);
      }
    };

    // 立即执行一次
    pollStatus();

    // 每 8 秒轮询一次
    const interval = setInterval(pollStatus, 8000);

    return () => clearInterval(interval);
  }, [generationId, isPolling]);

  // 切换收藏
  const handleToggleFavorite = async (imageUrl: string) => {
    if (!generationId) return;

    try {
      if (favorites.has(imageUrl)) {
        await removeFavorite(generationId, imageUrl);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(imageUrl);
          return next;
        });
        toast.success('已取消收藏');
      } else {
        await addFavorite(generationId, imageUrl);
        setFavorites((prev) => new Set(prev).add(imageUrl));
        toast.success('已添加收藏');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast.error('操作失败');
    }
  };

  // 下载单张图片
  const handleDownload = async (imageUrl: string) => {
    try {
      await downloadImage(imageUrl);
      toast.success('下载成功');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('下载失败');
    }
  };

  // 批量下载
  const handleBatchDownload = async () => {
    if (!generation?.result_images || generation.result_images.length === 0) {
      toast.error('没有可下载的图片');
      return;
    }

    setIsDownloading(true);
    try {
      toast.info(`开始下载 ${generation.result_images.length} 张图片...`);
      await downloadImagesAsZip(generation.result_images, 'hui-paper-art');
      toast.success('批量下载完成');
    } catch (error) {
      console.error('Batch download failed:', error);
      toast.error('批量下载失败');
    } finally {
      setIsDownloading(false);
    }
  };

  // 重新生成
  const handleRegenerate = () => {
    navigate('/');
  };

  // 计算进度百分比
  const getProgressPercentage = () => {
    if (!progress?.progress) return 0;
    const { total, success, failed } = progress.progress;
    return Math.round(((success + failed) / total) * 100);
  };

  return (
    <div className="hui-page">
      <div className="hui-shell">
        <header className="hui-topbar">
          <div className="hui-brand">
            <span className="hui-brand-mark">徽</span>
            <div className="hui-brand-copy">
              <h1 className="hui-brand-title">徽纸艺境</h1>
              <p className="hui-brand-subtitle">生成结果与候选画面</p>
            </div>
          </div>

          <div className="hui-result-actions">
            <Button variant="outline" className="hui-button-secondary" onClick={handleRegenerate}>
              <ArrowLeft className="h-4 w-4" />
              返回工坊
            </Button>
            <Button
              className="hui-button-primary"
              onClick={handleBatchDownload}
              disabled={!generation?.result_images || generation.result_images.length === 0 || isDownloading}
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
        </header>

        <main>
          <section className="hui-paper-panel hui-result-header">
            <div>
              <p className="hui-section-lead">结果画廊</p>
              <h2 className="hui-section-title">候选刻纸图像</h2>
              <p className="hui-section-description">
                当前结果基于你上传的建筑素材和提示词生成。可放大预览、收藏喜欢的方案，或者直接批量下载全部候选图。
              </p>

              <div className="hui-result-meta">
                <span className="hui-meta-chip">任务编号 {generationId?.slice(0, 8)}</span>
                {generation?.created_at && (
                  <span className="hui-meta-chip">
                    生成时间 {new Date(generation.created_at).toLocaleString('zh-CN')}
                  </span>
                )}
                <span className="hui-meta-chip">
                  输出数量 {generation?.generation_count ?? progress?.progress?.total ?? '--'} 张
                </span>
              </div>
            </div>

            <div className="hui-result-actions">
              <Button variant="outline" className="hui-button-secondary" onClick={handleRegenerate}>
                <RefreshCw className="h-4 w-4" />
                重新生成
              </Button>
            </div>
          </section>

          {isPolling && progress && (
            <section className="hui-paper-panel hui-progress-panel">
              <div>
                <h3 className="hui-card-title">正在生成中</h3>
                <p className="hui-card-desc">
                  {progress.progress && (
                    <>
                      已完成 {progress.progress.success + progress.progress.failed} / {progress.progress.total} 个任务
                      {progress.progress.failed > 0 && `，其中 ${progress.progress.failed} 个失败`}
                    </>
                  )}
                </p>
              </div>

              <div className="hui-progress-head">
                <div className="hui-hint">
                  生成进度会自动轮询更新，当前页面无需手动刷新。
                </div>
                <div className="hui-progress-value">{getProgressPercentage()}%</div>
              </div>

              <div className="hui-progress-bar">
                <span style={{ width: `${getProgressPercentage()}%` }} />
              </div>
            </section>
          )}

          <section className="hui-paper-panel hui-gallery-panel">
            <div className="hui-gallery-header">
              <div>
                <h3 className="hui-card-title">
                  {generation?.status === 'completed' && generation.result_images
                    ? `候选图像（${generation.result_images.length} 张）`
                    : '结果画廊'}
                </h3>
                <p className="hui-card-desc">
                  点击图片可放大预览，点击心形按钮收藏喜欢的作品。
                </p>
              </div>

              {favorites.size > 0 && (
                <div className="hui-meta-chip">
                  已收藏 {favorites.size} 张
                </div>
              )}
            </div>

            <ResultGrid
              images={generation?.result_images || []}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onDownload={handleDownload}
              isLoading={isPolling && !generation?.result_images}
            />
          </section>

          {generation?.status === 'failed' && (
            <section className="hui-paper-panel">
              <div className="hui-result-empty">
                <div className="space-y-4">
                  <p className="text-lg font-semibold text-destructive">生成失败</p>
                  <p className="hui-hint">{generation.error_message || '未知错误'}</p>
                  <Button onClick={handleRegenerate} className="hui-button-primary">
                    <RefreshCw className="h-4 w-4" />
                    重新生成
                  </Button>
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="hui-footer">
          <p>
            <strong>徽纸艺境</strong> 保留收藏和下载交互，结果页与首页共用同一套宣纸与朱红视觉。
          </p>
          <p>本地运行版 / 即时生成 / 非持久化结果</p>
        </footer>
      </div>
    </div>
  );
}
