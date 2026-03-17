import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResultGrid } from '@/components/ResultGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Download, RefreshCw, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={handleRegenerate}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">生成结果</h1>
                <p className="text-sm text-muted-foreground">
                  {generation?.created_at && new Date(generation.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={isPolling}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重新生成
              </Button>
              <Button
                onClick={handleBatchDownload}
                disabled={!generation?.result_images || generation.result_images.length === 0 || isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    下载中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    批量下载
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        {/* 进度显示 */}
        {isPolling && progress && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      正在生成中...
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {progress.progress && (
                        <>
                          已完成 {progress.progress.success + progress.progress.failed} / {progress.progress.total} 个任务
                          {progress.progress.failed > 0 && (
                            <span className="text-destructive ml-2">
                              ({progress.progress.failed} 个失败)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {getProgressPercentage()}%
                  </div>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  💡 生成过程需要 2-5 分钟，请耐心等待...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 结果展示 */}
        <div className="space-y-6">
          {generation?.status === 'completed' && generation.result_images && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                候选图像 ({generation.result_images.length} 张)
              </h2>
              <p className="text-sm text-muted-foreground">
                点击图片可放大预览，点击 ❤️ 收藏喜欢的作品
              </p>
            </div>
          )}

          <ResultGrid
            images={generation?.result_images || []}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onDownload={handleDownload}
            isLoading={isPolling && !generation?.result_images}
          />

          {/* 错误提示 */}
          {generation?.status === 'failed' && (
            <Card className="border-destructive">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <p className="text-lg font-semibold text-destructive">
                    生成失败
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {generation.error_message || '未知错误'}
                  </p>
                  <Button onClick={handleRegenerate}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新生成
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
