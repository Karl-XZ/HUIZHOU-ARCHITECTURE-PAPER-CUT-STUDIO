import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

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
    <div className="hui-form-stack">
      <section className="hui-form-card">
        <div className="hui-card-head">
          <div>
            <h4 className="hui-card-title">基础提示词</h4>
            <p className="hui-card-desc">用一句较长的描述固定主体题材、黑白关系和画面尺寸。</p>
          </div>
          <span className="hui-card-badge">基础语义</span>
        </div>
        <div>
          <Textarea
            value={basePrompt}
            onChange={(e) => onBasePromptChange(e.target.value)}
            placeholder="输入建筑特征描述..."
            className="hui-textarea"
          />
        </div>
      </section>

      <section className="hui-form-card">
        <div className="hui-card-head">
          <div>
            <h4 className="hui-card-title">二维转化提示词</h4>
            <p className="hui-card-desc">强调平面化透视、镂空雕刻和黑白剪纸的视觉语言。</p>
          </div>
          <span className="hui-card-badge">造型约束</span>
        </div>
        <div>
          <Textarea
            value={transformPrompt}
            onChange={(e) => onTransformPromptChange(e.target.value)}
            placeholder="输入转化效果描述..."
            className="hui-textarea"
          />
        </div>
      </section>

      <section className="hui-form-card">
        <div className="hui-card-head">
          <div>
            <h4 className="hui-card-title">AI 补全提示词</h4>
            <p className="hui-card-desc">当素材视角不够完整时，让模型补出缺失的建筑构件和空间关系。</p>
          </div>
          <label className="hui-toggle" htmlFor="ai-completion">
            <Checkbox
              id="ai-completion"
              className="hui-check"
              checked={aiCompletionEnabled}
              onCheckedChange={(checked) => onAiCompletionEnabledChange(checked === true)}
            />
            <span>启用 AI 补全</span>
          </label>
        </div>

        <div>
          <Textarea
            value={aiCompletionPrompt}
            onChange={(e) => onAiCompletionPromptChange(e.target.value)}
            placeholder="输入 AI 补全规则..."
            className="hui-textarea"
            disabled={!aiCompletionEnabled}
          />
          {!aiCompletionEnabled && (
            <p className="hui-hint mt-3">上传图片少于 2 张时，系统会自动启用结构补全。</p>
          )}
        </div>
      </section>
    </div>
  );
}
