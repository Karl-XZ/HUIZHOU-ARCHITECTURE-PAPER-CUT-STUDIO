import React, { useEffect, useRef, useState } from 'react';
import { Download, Heart, Loader2, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ResultGridProps {
  images: string[];
  favorites: Set<string>;
  onToggleFavorite: (imageUrl: string) => void;
  onDownload: (imageUrl: string) => void;
  isLoading?: boolean;
  isGenerating?: boolean;
  expectedCount?: number;
}

const TEXT = {
  imageLoadError: '\u56fe\u7247\u52a0\u8f7d\u5931\u8d25',
  empty: '\u6682\u65e0\u751f\u6210\u7ed3\u679c',
  generating: '\u6b63\u5728\u751f\u6210',
  candidatePrefix: '\u5019\u9009\u56fe',
  resultAltPrefix: '\u751f\u6210\u7ed3\u679c',
};

export function ResultGrid({
  images,
  favorites,
  onToggleFavorite,
  onDownload,
  isLoading = false,
  isGenerating = false,
  expectedCount,
}: ResultGridProps) {
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const knownImagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (images.length === 0) {
      knownImagesRef.current.clear();
      setLoadingImages(new Set());
      return;
    }

    setLoadingImages((previous) => {
      const next = new Set<string>();
      const currentImageSet = new Set(images);

      for (const image of previous) {
        if (currentImageSet.has(image)) {
          next.add(image);
        }
      }

      for (const image of images) {
        if (!knownImagesRef.current.has(image)) {
          knownImagesRef.current.add(image);
          next.add(image);
        }
      }

      for (const image of Array.from(knownImagesRef.current)) {
        if (!currentImageSet.has(image)) {
          knownImagesRef.current.delete(image);
        }
      }

      return next;
    });
  }, [images]);

  const handleImageLoad = (url: string) => {
    setLoadingImages((previous) => {
      const next = new Set(previous);
      next.delete(url);
      return next;
    });
  };

  const handleImageError = (url: string) => {
    setLoadingImages((previous) => {
      const next = new Set(previous);
      next.delete(url);
      return next;
    });
    toast.error(TEXT.imageLoadError);
  };

  const targetCount = expectedCount && expectedCount > 0 ? expectedCount : 4;
  const placeholderCount = isLoading || isGenerating
    ? Math.max(targetCount - images.length, 0)
    : 0;

  if (images.length === 0 && placeholderCount === 0) {
    return (
      <div className="hui-result-empty">
        <p>{TEXT.empty}</p>
      </div>
    );
  }

  return (
    <div className="hui-result-grid">
      {images.map((imageUrl, index) => {
        const isFavorited = favorites.has(imageUrl);
        const isImageLoading = loadingImages.has(imageUrl);

        return (
          <article key={imageUrl} className="hui-result-card group">
            <div className="hui-result-media">
              {isImageLoading && (
                <div className="hui-result-loading">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
              <img
                src={imageUrl}
                alt={`${TEXT.resultAltPrefix} ${index + 1}`}
                className={cn(
                  'w-full h-full object-cover transition-opacity',
                  isImageLoading && 'opacity-0',
                )}
                onLoad={() => handleImageLoad(imageUrl)}
                onError={() => handleImageError(imageUrl)}
              />

              <div className="hui-result-overlay">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="hui-icon-button">
                      <ZoomIn className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="hui-preview-dialog">
                    <img
                      src={imageUrl}
                      alt={`${TEXT.resultAltPrefix} ${index + 1}`}
                      className="w-full h-auto"
                    />
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="icon"
                  className="hui-icon-button"
                  onClick={() => onToggleFavorite(imageUrl)}
                >
                  <Heart
                    className={cn('h-5 w-5', isFavorited && 'fill-primary text-primary')}
                  />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="hui-icon-button"
                  onClick={() => onDownload(imageUrl)}
                >
                  <Download className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="hui-result-index">
              {String(index + 1).padStart(2, '0')}
            </div>

            {isFavorited && (
              <div className="hui-result-favorite">
                <Heart className="h-4 w-4 fill-current" />
              </div>
            )}
          </article>
        );
      })}

      {Array.from({ length: placeholderCount }).map((_, index) => {
        const slotIndex = images.length + index + 1;

        return (
          <article key={`placeholder-${slotIndex}`} className="hui-result-card is-placeholder">
            <div className="hui-result-media">
              <div className="hui-result-loading">
                <div className="hui-result-loading-stack">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <div className="hui-result-loading-copy">
                    <strong>{TEXT.generating}</strong>
                    <span>{`${TEXT.candidatePrefix} ${slotIndex}`}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hui-result-index">
              {String(slotIndex).padStart(2, '0')}
            </div>
          </article>
        );
      })}
    </div>
  );
}
