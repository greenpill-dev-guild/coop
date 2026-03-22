/**
 * Compress an image blob using browser-native canvas APIs.
 * Uses OffscreenCanvas in service worker context, HTMLCanvasElement as fallback.
 */
export async function compressImage(input: {
  blob: Blob;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg';
}): Promise<{ blob: Blob; width: number; height: number }> {
  const { blob, maxWidth = 1920, maxHeight = 1080, quality = 0.82, format = 'webp' } = input;

  const bitmap = await createImageBitmap(blob);
  const { width: origW, height: origH } = bitmap;

  // Calculate scaled dimensions preserving aspect ratio
  let width = origW;
  let height = origH;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';

  try {
    // Prefer OffscreenCanvas (works in service workers)
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('Failed to get 2d context from OffscreenCanvas');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const result = await canvas.convertToBlob({ type: mimeType, quality });
      return { blob: result, width, height };
    }

    // Fallback: HTMLCanvasElement (main thread)
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('Failed to get 2d context from HTMLCanvasElement');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const result = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
          mimeType,
          quality,
        );
      });
      return { blob: result, width, height };
    }

    bitmap.close();
    throw new Error('No canvas API available for image compression');
  } catch (err) {
    // Ensure bitmap is closed even on unexpected errors
    try {
      bitmap.close();
    } catch {
      // already closed
    }
    throw err;
  }
}

/**
 * Generate a tiny thumbnail data URL for inline preview.
 * Target: < 2KB data URI.
 */
export async function generateThumbnailDataUrl(input: {
  blob: Blob;
  maxSize?: number;
  quality?: number;
}): Promise<string> {
  const { blob, maxSize = 64, quality = 0.5 } = input;

  const bitmap = await createImageBitmap(blob);
  const { width: origW, height: origH } = bitmap;

  // Scale to fit within maxSize x maxSize
  const ratio = Math.min(maxSize / origW, maxSize / origH, 1);
  const width = Math.round(origW * ratio);
  const height = Math.round(origH * ratio);

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('Failed to get 2d context from OffscreenCanvas');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const thumbBlob = await canvas.convertToBlob({ type: 'image/webp', quality });
      const buffer = await thumbBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return `data:image/webp;base64,${btoa(binary)}`;
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        throw new Error('Failed to get 2d context from HTMLCanvasElement');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return canvas.toDataURL('image/webp', quality);
    }

    bitmap.close();
    throw new Error('No canvas API available for thumbnail generation');
  } catch (err) {
    try {
      bitmap.close();
    } catch {
      // already closed
    }
    throw err;
  }
}
