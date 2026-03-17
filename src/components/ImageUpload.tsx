import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploadProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
}

export function ImageUpload({ images, onImagesChange, maxImages = 10 }: ImageUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // 检查文件数量限制
      if (images.length + acceptedFiles.length > maxImages) {
        toast.error(`最多上传 ${maxImages} 张图片`);
        return;
      }

      // 检查文件格式
      const validFiles = acceptedFiles.filter((file) => {
        const isValid = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isValid) {
          toast.error(`${file.name} 格式不支持，仅支持 JPG、PNG 格式`);
        }
        return isValid;
      });

      if (validFiles.length === 0) return;

      // 生成预览
      const newPreviews: string[] = [];
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === validFiles.length) {
            setPreviews([...previews, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });

      onImagesChange([...images, ...validFiles]);
      toast.success(`成功添加 ${validFiles.length} 张图片`);
    },
    [images, onImagesChange, maxImages, previews]
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
      {/* 上传区域 */}
      <Card
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed p-8 transition-colors cursor-pointer',
          isDragActive && 'border-primary bg-accent',
          images.length >= maxImages && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
            <Upload className="w-8 h-8 text-accent-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              {isDragActive ? '释放以上传图片' : '点击或拖拽上传建筑照片'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              支持 JPG、PNG 格式，最多 {maxImages} 张
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              建议包含正面、侧面、局部细节等不同角度
            </p>
          </div>
        </div>
      </Card>

      {/* 已上传图片列表 */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">
              已上传 {images.length} / {maxImages} 张
            </p>
            {images.length < 2 && (
              <p className="text-xs text-primary">
                ⚠️ 图片少于 2 张时将自动启用 AI 补全
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border-2 border-border bg-muted">
                  <img
                    src={preview}
                    alt={`上传图片 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-2 left-2 bg-secondary/80 text-secondary-foreground text-xs px-2 py-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态提示 */}
      {images.length === 0 && (
        <div className="flex items-center justify-center p-6 bg-muted/50 rounded-lg">
          <div className="text-center space-y-2">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">还未上传任何图片</p>
          </div>
        </div>
      )}
    </div>
  );
}
