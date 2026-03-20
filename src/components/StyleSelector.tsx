import React from 'react';

import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
    description: '强调细密镂空、装饰纹样、对称秩序与强烈刀感。',
    keywords:
      '传统金坛刻纸，民间剪纸语言，黑白纯色，强对比，细密镂空，装饰纹样，窗棂花纹，对称构图，刀口清晰，边缘利落，纸雕感强，避免照片感',
  },
  {
    value: 'modern',
    label: '现代简化剪纸风格',
    description: '保留金坛刻纸工艺语言，但块面更大、留白更多、构成更现代。',
    keywords:
      '以金坛刻纸工艺语言为基底，现代简化剪纸，大块面对比，留白更大，平面构成更强，线条概括，装饰感克制，但仍然保持刀刻边缘与黑白纯色',
  },
  {
    value: 'custom',
    label: '自定义风格',
    description: '手动输入额外风格关键词，系统仍会维持金坛刻纸的基础语汇。',
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
    <section className="hui-form-card">
      <div className="hui-card-head">
        <div>
          <h4 className="hui-card-title">风格选择</h4>
          <p className="hui-card-desc">
            在传统纹样、现代简化和自定义语义之间切换输出倾向。
          </p>
        </div>
        <span className="hui-card-badge">风格设定</span>
      </div>

      <RadioGroup
        className="hui-style-group"
        value={styleType}
        onValueChange={onStyleTypeChange as (value: string) => void}
      >
        {STYLE_OPTIONS.map((option) => (
          <label
            key={option.value}
            htmlFor={option.value}
            className={`hui-style-option ${styleType === option.value ? 'is-active' : ''}`}
          >
            <RadioGroupItem value={option.value} id={option.value} className="hui-radio mt-1" />
            <div>
              <h5 className="hui-option-title">{option.label}</h5>
              <p className="hui-option-desc">{option.description}</p>
              {option.value !== 'custom' && (
                <div className="hui-option-keywords">{option.keywords}</div>
              )}
            </div>
          </label>
        ))}
      </RadioGroup>

      {styleType === 'custom' && (
        <div className="mt-4">
          <p className="hui-card-desc mb-2">自定义风格关键词</p>
          <Input
            id="custom-keywords"
            value={customStyleKeywords}
            onChange={(e) => onCustomStyleKeywordsChange(e.target.value)}
            placeholder="输入风格关键词，如：刀刻质感、极简黑白、戏剧化构图..."
            className="hui-input"
          />
        </div>
      )}
    </section>
  );
}

export function getStyleKeywords(
  styleType: 'traditional' | 'modern' | 'custom',
  customKeywords: string,
): string {
  const option = STYLE_OPTIONS.find((item) => item.value === styleType);

  if (styleType === 'custom') {
    return customKeywords;
  }

  return option?.keywords || '';
}
