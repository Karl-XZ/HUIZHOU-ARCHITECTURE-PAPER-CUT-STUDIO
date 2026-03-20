import type { CandidatePlan } from '@/types';

const PAPER_CUT_STYLE_PRIORITY =
  '金坛刻纸风格优先级最高，必须呈现手工刻纸语言而不是照片滤镜，黑白纯色，高对比，无灰度过渡，无真实光影，无写实材质，强调刀刻边缘、镂空留白、民间纹样与装饰秩序。';

const PAPER_CUT_STYLE_GUARDRAIL =
  '保持徽派建筑主体识别度，避免照片写实感、避免 3D 渲染感、避免油画水彩笔触、避免模糊涂抹，画面始终更像金坛刻纸成品。';

const CANDIDATE_VARIANTS: Array<{ label: string; prompt: string }> = [
  {
    label: '主立面',
    prompt: '以完整主立面为主，主体居中，中轴稳定，屋脊层层展开，适合作为标准成片。',
  },
  {
    label: '院落纵深',
    prompt: '强调院落、门洞、回廊与前后景的纵深关系，构图带有明显空间递进。',
  },
  {
    label: '马头墙剪影',
    prompt: '强调马头墙起伏、屋脊剪影和飞檐轮廓，黑白对比更强，边缘更锋利。',
  },
  {
    label: '窗棂纹样',
    prompt: '强调窗棂、砖雕、栏杆与装饰纹样，让金坛刻纸的细密镂空更突出。',
  },
  {
    label: '留白装饰',
    prompt: '加大留白与镂空比例，形成更强的装饰感和平面节奏，突出纸雕层次。',
  },
  {
    label: '檐口特写',
    prompt: '聚焦檐口、梁架、门罩等局部结构，让刀刻质感和局部细节更明显。',
  },
  {
    label: '层叠拼贴',
    prompt: '突出前景、中景、背景的纸层堆叠关系，让画面更像层叠拼贴的刻纸作品。',
  },
  {
    label: '门洞框景',
    prompt: '以前景门洞或框景包裹主体建筑，形成内外嵌套的纸雕画面。',
  },
];

function normalizePromptParts(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

function pickCandidateReferenceImages(uploadedImages: string[], index: number) {
  if (uploadedImages.length <= 1) {
    return uploadedImages;
  }

  if (uploadedImages.length === 2) {
    return index % 2 === 0
      ? [...uploadedImages]
      : [uploadedImages[1], uploadedImages[0]];
  }

  const selected: string[] = [];
  const limit = Math.min(uploadedImages.length, 3);
  const start = index % uploadedImages.length;

  for (let offset = 0; offset < limit; offset += 1) {
    selected.push(uploadedImages[(start + offset) % uploadedImages.length]);
  }

  return selected;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function filesToBase64Array(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => fileToBase64(file)));
}

export async function downloadImage(url: string, filename?: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || `hui-paper-art-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('下载失败');
  }
}

export async function downloadImagesAsZip(urls: string[], baseFilename = 'hui-paper-art') {
  for (let index = 0; index < urls.length; index += 1) {
    await downloadImage(urls[index], `${baseFilename}-${index + 1}.png`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export function mergePrompts(
  basePrompt: string,
  transformPrompt: string,
  styleKeywords: string,
  aiCompletionEnabled: boolean,
  aiCompletionPrompt: string,
): string {
  const parts = [
    basePrompt,
    transformPrompt,
    styleKeywords,
    PAPER_CUT_STYLE_PRIORITY,
  ];

  if (aiCompletionEnabled && aiCompletionPrompt.trim()) {
    parts.push(aiCompletionPrompt);
  }

  parts.push(PAPER_CUT_STYLE_GUARDRAIL);

  return normalizePromptParts(parts);
}

export function buildCandidatePlans(
  uploadedImages: string[],
  finalPrompt: string,
  generationCount: number,
): CandidatePlan[] {
  return Array.from({ length: Math.max(generationCount, 1) }, (_, index) => {
    const variant = CANDIDATE_VARIANTS[index % CANDIDATE_VARIANTS.length];

    return {
      prompt: normalizePromptParts([
        finalPrompt,
        variant.prompt,
        '与其他候选图拉开差异，保持同一建筑主体，但在构图重心、黑白面积和细节强调上明显不同。',
        '金坛刻纸风格继续保持高优先级，避免重新回到写实照片感。',
      ]),
      uploadedImages: pickCandidateReferenceImages(uploadedImages, index),
      variantLabel: variant.label,
    };
  });
}
