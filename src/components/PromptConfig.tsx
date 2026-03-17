import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PromptConfigProps {
  basePrompt: string;
  onBasePromptChange: (value: string) => void;
  transformPrompt: string;
  onTransformPromptChange: (value: string) => void;
  aiCompletionEnabled: boolean;
  onAiCompletionEnabledChange: (value: boolean) => void;
  aiCompletionPrompt: string;
  onAiCompletionPromptChange: (value: string) => void;
}

export function PromptConfig({
  basePrompt,
  onBasePromptChange,
  transformPrompt,
  onTransformPromptChange,
  aiCompletionEnabled,
  onAiCompletionEnabledChange,
  aiCompletionPrompt,
  onAiCompletionPromptChange,
}: PromptConfigProps) {
  return (
    <div className="space-y-6">
      {/* 基础提示词 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基础提示词</CardTitle>
          <CardDescription>描述徽派建筑的核心特征</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={basePrompt}
            onChange={(e) => onBasePromptChange(e.target.value)}
            placeholder="输入建筑特征描述..."
            className="min-h-24 resize-none"
          />
        </CardContent>
      </Card>

      {/* 二维转化提示词 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">二维转化提示词</CardTitle>
          <CardDescription>定义刻纸风格的转化效果</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={transformPrompt}
            onChange={(e) => onTransformPromptChange(e.target.value)}
            placeholder="输入转化效果描述..."
            className="min-h-24 resize-none"
          />
        </CardContent>
      </Card>

      {/* AI 补全提示词 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">AI 补全提示词</CardTitle>
              <CardDescription>当素材不足时，AI 自动补全建筑结构</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ai-completion"
                checked={aiCompletionEnabled}
                onCheckedChange={(checked) => onAiCompletionEnabledChange(checked === true)}
              />
              <Label
                htmlFor="ai-completion"
                className="text-sm font-medium cursor-pointer"
              >
                启用 AI 补全
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={aiCompletionPrompt}
            onChange={(e) => onAiCompletionPromptChange(e.target.value)}
            placeholder="输入 AI 补全规则..."
            className="min-h-24 resize-none"
            disabled={!aiCompletionEnabled}
          />
          {!aiCompletionEnabled && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 上传图片少于 2 张时将自动启用
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
