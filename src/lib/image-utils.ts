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

const MAX_IMAGE_DIMENSION = 1400;
const MAX_TOTAL_BINARY_BYTES = 2_400_000;
const MIN_BINARY_BYTES_PER_IMAGE = 140_000;
const MAX_BINARY_BYTES_PER_IMAGE = 320_000;

function normalizePromptParts(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

function pickCandidateReferenceImageIndexes(imageCount: number, index: number) {
  if (imageCount <= 1) {
    return [0];
  }

  if (imageCount === 2) {
    return index % 2 === 0 ? [0, 1] : [1, 0];
  }

  const selected: number[] = [];
  const limit = Math.min(imageCount, 3);
  const start = index % imageCount;

  for (let offset = 0; offset < limit; offset += 1) {
    selected.push((start + offset) % imageCount);
  }

  return selected;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBase64(file: Blob) {
  const dataUrl = await readFileAsDataUrl(file);
  return dataUrl.split(',')[1];
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('Failed to encode image'));
      },
      'image/jpeg',
      quality,
    );
  });
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      reject(event);
    };

    image.src = objectUrl;
  });
}

async function compressImageToBase64(file: File, targetBinaryBytes: number) {
  const image = await loadImageElement(file);
  let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  let quality = 0.86;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is not supported in this browser');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, quality);
    bestBlob = blob;

    if (blob.size <= targetBinaryBytes) {
      return dataUrlToBase64(blob);
    }

    if (quality > 0.58) {
      quality -= 0.08;
    } else {
      scale *= 0.85;
    }
  }

  return dataUrlToBase64(bestBlob ?? file);
}

export async function fileToBase64(file: File, targetBinaryBytes = MAX_BINARY_BYTES_PER_IMAGE): Promise<string> {
  const shouldCompress =
    file.size > targetBinaryBytes ||
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg';

  if (!shouldCompress) {
    return dataUrlToBase64(file);
  }

  return compressImageToBase64(file, targetBinaryBytes);
}

export async function filesToBase64Array(files: File[]): Promise<string[]> {
  const safeImageCount = Math.max(files.length, 1);
  const targetBinaryBytes = Math.min(
    MAX_BINARY_BYTES_PER_IMAGE,
    Math.max(MIN_BINARY_BYTES_PER_IMAGE, Math.floor(MAX_TOTAL_BINARY_BYTES / safeImageCount)),
  );

  return Promise.all(files.map((file) => fileToBase64(file, targetBinaryBytes)));
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
      imageIndexes: pickCandidateReferenceImageIndexes(uploadedImages.length, index),
      variantLabel: variant.label,
    };
  });
}
