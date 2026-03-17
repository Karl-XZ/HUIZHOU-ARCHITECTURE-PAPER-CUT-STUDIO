import React, { useState } from 'react';
import { Download, Heart, ZoomIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ResultGridProps {
  images: string[];
  favorites: Set<string>;
  onToggleFavorite: (imageUrl: string) => void;
  onDownload: (imageUrl: string) => void;
  isLoading?: boolean;
}

export function ResultGrid({
  images,
  favorites,
  onToggleFavorite,
  onDownload,
  isLoading = false,
}: ResultGridProps) {
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (url: string) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  };

  const handleImageError = (url: string) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
    toast.error('图片加载失败');
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="aspect-square bg-muted animate-pulse flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">暂无生成结果</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {images.map((imageUrl, index) => {
        const isFavorited = favorites.has(imageUrl);
        const isImageLoading = loadingImages.has(imageUrl);

        return (
          <Card key={index} className="overflow-hidden group relative">
            {/* 图片容器 */}
            <div className="aspect-square bg-muted relative">
              {isImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              )}
              <img
                src={imageUrl}
                alt={`生成结果 ${index + 1}`}
                className={cn(
                  'w-full h-full object-cover transition-opacity',
                  isImageLoading && 'opacity-0'
                )}
                onLoad={() => handleImageLoad(imageUrl)}
                onError={() => handleImageError(imageUrl)}
              />

              {/* 悬浮操作栏 */}
              <div className="absolute inset-0 bg-secondary/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {/* 放大预览 */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="icon" className="w-10 h-10">
                      <ZoomIn className="w-5 h-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-0">
                    <img
                      src={imageUrl}
                      alt={`生成结果 ${index + 1}`}
                      className="w-full h-auto"
                    />
                  </DialogContent>
                </Dialog>

                {/* 收藏 */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-10 h-10"
                  onClick={() => onToggleFavorite(imageUrl)}
                >
                  <Heart
                    className={cn(
                      'w-5 h-5',
                      isFavorited && 'fill-primary text-primary'
                    )}
                  />
                </Button>

                {/* 下载 */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-10 h-10"
                  onClick={() => onDownload(imageUrl)}
                >
                  <Download className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* 图片序号 */}
            <div className="absolute top-3 left-3 bg-secondary/90 text-secondary-foreground text-sm font-medium px-3 py-1 rounded-full">
              {index + 1}
            </div>

            {/* 收藏标记 */}
            {isFavorited && (
              <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground p-2 rounded-full">
                <Heart className="w-4 h-4 fill-current" />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
