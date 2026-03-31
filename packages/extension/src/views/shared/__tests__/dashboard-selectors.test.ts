import { describe, expect, it } from 'vitest';
import { resolvePreviewCardImageUrl } from '../dashboard-selectors';

describe('resolvePreviewCardImageUrl', () => {
  it('prefers explicit preview images before social preview and favicon fallbacks', () => {
    expect(
      resolvePreviewCardImageUrl({
        previewImageUrl: 'https://example.com/preview.png',
        sources: [
          {
            label: 'Source',
            url: 'https://example.com/story',
            domain: 'example.com',
            socialPreviewImageUrl: 'https://example.com/social.png',
            faviconUrl: 'https://example.com/favicon.ico',
          },
        ],
      }),
    ).toBe('https://example.com/preview.png');

    expect(
      resolvePreviewCardImageUrl({
        previewImageUrl: undefined,
        sources: [
          {
            label: 'Source',
            url: 'https://example.com/story',
            domain: 'example.com',
            socialPreviewImageUrl: 'https://example.com/social.png',
            faviconUrl: 'https://example.com/favicon.ico',
          },
        ],
      }),
    ).toBe('https://example.com/social.png');

    expect(
      resolvePreviewCardImageUrl({
        previewImageUrl: undefined,
        sources: [
          {
            label: 'Source',
            url: 'https://example.com/story',
            domain: 'example.com',
            faviconUrl: 'https://example.com/favicon.ico',
          },
        ],
      }),
    ).toBe('https://example.com/favicon.ico');
  });
});
