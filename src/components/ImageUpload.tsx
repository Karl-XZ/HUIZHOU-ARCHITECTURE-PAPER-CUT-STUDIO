import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploadProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
}

export function ImageUpload({ images, onImagesChange, maxImages = 10 }: ImageUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadPreviews = async () => {
      if (images.length === 0) {
        setPreviews([]);
        return;
      }

      const urls = await Promise.all(
        images.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            })
        )
      );

      if (!cancelled) {
        setPreviews(urls);
      }
    };

    loadPreviews().catch((error) => {
      console.error('Failed to load previews:', error);
      if (!cancelled) {
        toast.error('预览图加载失败');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [images]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (images.length + acceptedFiles.length > maxImages) {
        toast.error(`最多上传 ${maxImages} 张图片`);
        return;
      }

      const validFiles = acceptedFiles.filter((file) => {
        const isValid = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isValid) {
          toast.error(`${file.name} 格式不支持，仅支持 JPG、PNG 格式`);
        }
        return isValid;
      });

      if (validFiles.length === 0) return;

      onImagesChange([...images, ...validFiles]);
      toast.success(`成功添加 ${validFiles.length} 张图片`);
    },
    [images, onImagesChange, maxImages]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: maxImages,
    disabled: images.length >= maxImages,
  });

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    onImagesChange(newImages);
    setPreviews(newPreviews);
    toast.success('已删除图片');
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'hui-upload-zone',
          isDragActive && 'is-dragging',
          images.length >= maxImages && 'is-disabled'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center">
          <div className="hui-upload-icon">
            <Upload className="h-8 w-8" />
          </div>
          <div>
            <p className="hui-upload-title">
              {isDragActive ? '释放以上传建筑照片' : '点击或拖拽上传建筑照片'}
            </p>
            <p className="hui-upload-copy">
              支持 JPG、PNG，最多 {maxImages} 张。建议包含正立面、斜角和局部细节，方便保持建筑结构识别度。
            </p>
          </div>
        </div>
      </div>

      {images.length > 0 && (
        <div>
          <div className="hui-upload-summary mb-3">
            <p className="text-sm font-medium text-foreground">
              已上传 {images.length} / {maxImages} 张
            </p>
            {images.length < 2 && (
              <p className="hui-alert">
                图片少于 2 张时将自动启用 AI 补全
              </p>
            )}
          </div>
          <div className="hui-preview-grid md:grid-cols-5">
            {previews.map((preview, index) => (
              <div key={index} className="hui-preview-card group">
                <div className="hui-preview-inner">
                  <img
                    src={preview}
                    alt={`上传图片 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="hui-preview-remove opacity-0 group-hover:opacity-100"
                  onClick={() => removeImage(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="hui-preview-index">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="hui-empty-state">
          <div className="text-center space-y-2">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">还未上传任何图片</p>
          </div>
        </div>
      )}
    </div>
  );
}
