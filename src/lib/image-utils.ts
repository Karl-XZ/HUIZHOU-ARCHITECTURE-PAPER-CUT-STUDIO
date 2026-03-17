/**
 * 将 File 对象转换为 Base64 字符串（不含 data URL 前缀）
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:image/xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 批量将 File 对象转换为 Base64 字符串数组
 */
export async function filesToBase64Array(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => fileToBase64(file)));
}

/**
 * 下载图片
 */
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

/**
 * 批量下载图片为 ZIP（简化版：逐个下载）
 */
export async function downloadImagesAsZip(urls: string[], baseFilename = 'hui-paper-art') {
  for (let i = 0; i < urls.length; i++) {
    await downloadImage(urls[i], `${baseFilename}-${i + 1}.png`);
    // 添加延迟避免浏览器阻止多个下载
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * 合并提示词
 */
export function mergePrompts(
  basePrompt: string,
  transformPrompt: string,
  styleKeywords: string,
  aiCompletionEnabled: boolean,
  aiCompletionPrompt: string
): string {
  const parts = [basePrompt, transformPrompt, styleKeywords];

  if (aiCompletionEnabled && aiCompletionPrompt) {
    parts.push(aiCompletionPrompt);
  }

  return parts.filter(Boolean).join('，');
}
