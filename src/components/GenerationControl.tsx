import React from 'react';
import { Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface GenerationControlProps {
  generationCount: number;
  onGenerationCountChange: (value: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const TEXT = {
  title: '\u751f\u6210\u8bbe\u7f6e',
  desc: '\u63a7\u5236\u5019\u9009\u56fe\u6570\u91cf\u4e0e\u8f93\u51fa\u8282\u594f\u3002',
  badge: '\u8f93\u51fa\u63a7\u5236',
  label: '\u751f\u6210\u6570\u91cf',
  buttonIdle: '\u5f00\u59cb\u751f\u6210\u5019\u9009\u56fe',
  buttonBusy: '\u751f\u6210\u4e2d...',
  noteOne: '\u4efb\u52a1\u63d0\u4ea4\u540e\u4f1a\u81ea\u52a8\u67e5\u8be2\u8fdb\u5ea6\u3002',
  noteTwo: '\u5019\u9009\u56fe\u4f1a\u6309\u5b8c\u6210\u987a\u5e8f\u5728\u9875\u9762\u4e2d\u9010\u5f20\u5448\u73b0\u3002',
};

export function GenerationControl({
  generationCount,
  onGenerationCountChange,
  onGenerate,
  isGenerating,
  disabled = false,
}: GenerationControlProps) {
  return (
    <section className="hui-generation-card">
      <div className="hui-card-head">
        <div>
          <h4 className="hui-card-title">{TEXT.title}</h4>
          <p className="hui-card-desc">{TEXT.desc}</p>
        </div>
        <span className="hui-card-badge">{TEXT.badge}</span>
      </div>

      <div className="space-y-3">
        <div className="hui-slider-head">
          <Label htmlFor="generation-count" className="hui-slider-label">
            {TEXT.label}
          </Label>
          <span className="hui-slider-value">{generationCount}</span>
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

        <div className="hui-range-scale">
          <span>4 张</span>
          <span>8 张</span>
        </div>

        <Button
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          className="hui-button-primary hui-generate-button"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              {TEXT.buttonBusy}
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              {TEXT.buttonIdle}
            </>
          )}
        </Button>

        <div className="hui-note-list">
          <p className="hui-note">{TEXT.noteOne}</p>
          <p className="hui-note">{TEXT.noteTwo}</p>
        </div>
      </div>
    </section>
  );
}
