import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage, generateThumbnailDataUrl } from '../compress';

// Create mock helpers
function createMockImageBitmap(width: number, height: number) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

function createMockBlob(size: number, type = 'image/png'): Blob {
  const data = new Uint8Array(size);
  return new Blob([data], { type });
}

describe('compressImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock createImageBitmap globally
    vi.stubGlobal('createImageBitmap', vi.fn());
  });

  it('compresses to WebP with correct dimensions', async () => {
    const inputBlob = createMockBlob(50_000, 'image/png');
    const outputBlob = createMockBlob(5_000, 'image/webp');

    const mockBitmap = createMockImageBitmap(3840, 2160);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    // Mock OffscreenCanvas
    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(outputBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    const result = await compressImage({ blob: inputBlob });

    // Should scale down from 3840x2160 to fit within 1920x1080
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.blob).toBe(outputBlob);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.82 });
    expect(mockBitmap.close).toHaveBeenCalled();
  });

  it('preserves aspect ratio when only one dimension exceeds max', async () => {
    const inputBlob = createMockBlob(10_000);
    const outputBlob = createMockBlob(2_000, 'image/webp');

    const mockBitmap = createMockImageBitmap(2400, 600);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(outputBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    const result = await compressImage({ blob: inputBlob });

    // 2400 > 1920, ratio = 1920/2400 = 0.8, height = 600*0.8 = 480
    expect(result.width).toBe(1920);
    expect(result.height).toBe(480);
  });

  it('does not upscale small images', async () => {
    const inputBlob = createMockBlob(1_000);
    const outputBlob = createMockBlob(500, 'image/webp');

    const mockBitmap = createMockImageBitmap(800, 600);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(outputBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    const result = await compressImage({ blob: inputBlob });

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('supports JPEG format option', async () => {
    const inputBlob = createMockBlob(10_000);
    const outputBlob = createMockBlob(3_000, 'image/jpeg');

    const mockBitmap = createMockImageBitmap(1000, 1000);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(outputBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    const result = await compressImage({ blob: inputBlob, format: 'jpeg' });

    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.82 });
    expect(result.blob).toBe(outputBlob);
  });

  it('respects custom maxWidth and maxHeight', async () => {
    const inputBlob = createMockBlob(10_000);
    const outputBlob = createMockBlob(1_000, 'image/webp');

    const mockBitmap = createMockImageBitmap(2000, 2000);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(outputBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    const result = await compressImage({ blob: inputBlob, maxWidth: 500, maxHeight: 500 });

    expect(result.width).toBe(500);
    expect(result.height).toBe(500);
  });

  it('falls back to HTMLCanvasElement when OffscreenCanvas is unavailable', async () => {
    const inputBlob = createMockBlob(10_000);
    const outputBlob = createMockBlob(2_000, 'image/webp');

    const mockBitmap = createMockImageBitmap(1000, 800);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    // Remove OffscreenCanvas
    vi.stubGlobal('OffscreenCanvas', undefined);

    // Mock document.createElement to return a canvas with toBlob
    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi
        .fn()
        .mockImplementation((cb: (b: Blob | null) => void, _type: string, _q: number) => {
          cb(outputBlob);
        }),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement);

    const result = await compressImage({ blob: inputBlob });

    expect(result.width).toBe(1000);
    expect(result.height).toBe(800);
    expect(result.blob).toBe(outputBlob);
    expect(mockCanvas.toBlob).toHaveBeenCalled();
    expect(mockBitmap.close).toHaveBeenCalled();
  });

  it('throws when no canvas API is available', async () => {
    const inputBlob = createMockBlob(10_000);
    const mockBitmap = createMockImageBitmap(1000, 800);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', undefined);

    await expect(compressImage({ blob: inputBlob })).rejects.toThrow(
      'No canvas API available for image compression',
    );
  });
});

describe('generateThumbnailDataUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('createImageBitmap', vi.fn());
  });

  it('generates a data URL within size budget', async () => {
    const inputBlob = createMockBlob(50_000, 'image/png');
    // Small thumbnail blob
    const thumbBytes = new Uint8Array(500);
    const thumbBlob = new Blob([thumbBytes], { type: 'image/webp' });

    const mockBitmap = createMockImageBitmap(1920, 1080);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(thumbBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    const dataUrl = await generateThumbnailDataUrl({ blob: inputBlob });

    expect(dataUrl).toMatch(/^data:image\/webp;base64,/);
    // Should be under 2KB
    expect(dataUrl.length).toBeLessThan(2048);
  });

  it('scales down to maxSize preserving aspect ratio', async () => {
    const inputBlob = createMockBlob(10_000);
    const thumbBlob = new Blob([new Uint8Array(100)], { type: 'image/webp' });

    const mockBitmap = createMockImageBitmap(1920, 1080);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(thumbBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    await generateThumbnailDataUrl({ blob: inputBlob, maxSize: 64 });

    // OffscreenCanvas should be created with scaled dimensions
    // 1920x1080 -> ratio = min(64/1920, 64/1080) = 64/1920 ~ 0.0333
    // width = round(1920*0.0333) = 64, height = round(1080*0.0333) = 36
    expect(OffscreenCanvas).toHaveBeenCalledWith(64, 36);
  });

  it('does not upscale small images for thumbnails', async () => {
    const inputBlob = createMockBlob(1_000);
    const thumbBlob = new Blob([new Uint8Array(50)], { type: 'image/webp' });

    const mockBitmap = createMockImageBitmap(32, 24);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(thumbBlob),
    };
    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation(() => mockCanvas),
    );

    await generateThumbnailDataUrl({ blob: inputBlob, maxSize: 64 });

    // Image is already smaller than maxSize, should not upscale
    // ratio = min(64/32, 64/24, 1) = 1
    expect(OffscreenCanvas).toHaveBeenCalledWith(32, 24);
  });

  it('throws when no canvas API is available', async () => {
    const inputBlob = createMockBlob(10_000);
    const mockBitmap = createMockImageBitmap(100, 100);
    vi.mocked(createImageBitmap).mockResolvedValue(mockBitmap);

    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', undefined);

    await expect(generateThumbnailDataUrl({ blob: inputBlob })).rejects.toThrow(
      'No canvas API available for thumbnail generation',
    );
  });
});
