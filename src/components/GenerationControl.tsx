import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface GenerationControlProps {
  generationCount: number;
  onGenerationCountChange: (value: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function GenerationControl({
  generationCount,
  onGenerationCountChange,
  onGenerate,
  isGenerating,
  disabled = false,
}: GenerationControlProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">生成设置</CardTitle>
        <CardDescription>配置生成数量并开始创作</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 生成数量滑块 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="generation-count" className="text-sm font-medium">
              生成数量
            </Label>
            <span className="text-2xl font-bold text-primary">{generationCount}</span>
          </div>
          <Slider
            id="generation-count"
            min={4}
            max={8}
            step={1}
            value={[generationCount]}
            onValueChange={(values) => onGenerationCountChange(values[0])}
            disabled={isGenerating}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>4 张</span>
            <span>8 张</span>
          </div>
        </div>

        {/* 生成按钮 */}
        <Button
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          className="w-full h-12 text-lg"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              开始生成
            </>
          )}
        </Button>

        {/* 提示信息 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 生成过程需要 2-5 分钟，请耐心等待</p>
          <p>💡 系统将生成 {generationCount} 张候选图像供您选择</p>
        </div>
      </CardContent>
    </Card>
  );
}
