import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StyleSelectorProps {
  styleType: 'traditional' | 'modern' | 'custom';
  onStyleTypeChange: (value: 'traditional' | 'modern' | 'custom') => void;
  customStyleKeywords: string;
  onCustomStyleKeywordsChange: (value: string) => void;
}

const STYLE_OPTIONS = [
  {
    value: 'traditional',
    label: '传统金坛刻纸风格',
    description: '精细镂空、装饰性纹样、对称构图',
    keywords: '传统金坛刻纸，精细镂空，装饰性纹样，对称构图，传统工艺',
  },
  {
    value: 'modern',
    label: '现代简约剪纸风格',
    description: '大块面黑白对比、艺术化表达',
    keywords: '现代简约剪纸，大块面对比，艺术化表达，简洁线条，现代美学',
  },
  {
    value: 'custom',
    label: '自定义风格',
    description: '手动输入风格关键词',
    keywords: '',
  },
];

export function StyleSelector({
  styleType,
  onStyleTypeChange,
  customStyleKeywords,
  onCustomStyleKeywordsChange,
}: StyleSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">风格选择</CardTitle>
        <CardDescription>选择刻纸艺术风格</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={styleType} onValueChange={onStyleTypeChange as (value: string) => void}>
          <div className="space-y-4">
            {STYLE_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={option.value} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                  {option.value !== 'custom' && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted px-2 py-1 rounded">
                      {option.keywords}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>

        {/* 自定义风格输入 */}
        {styleType === 'custom' && (
          <div className="mt-4">
            <Label htmlFor="custom-keywords" className="text-sm font-medium">
              自定义风格关键词
            </Label>
            <Input
              id="custom-keywords"
              value={customStyleKeywords}
              onChange={(e) => onCustomStyleKeywordsChange(e.target.value)}
              placeholder="输入风格关键词，如：抽象、几何、渐变..."
              className="mt-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 导出风格关键词映射
export function getStyleKeywords(
  styleType: 'traditional' | 'modern' | 'custom',
  customKeywords: string
): string {
  const option = STYLE_OPTIONS.find((opt) => opt.value === styleType);
  if (styleType === 'custom') {
    return customKeywords;
  }
  return option?.keywords || '';
}
