import { describe, expect, it } from 'vitest';
import { extractPageSnapshot, isSupportedUrl } from '../tab-capture';

describe('tab capture helpers', () => {
  it('extracts headings, paragraphs, and preview metadata from the document', () => {
    document.head.innerHTML = `
      <meta name="description" content="A local-first page" />
      <meta property="og:image" content="https://example.com/cover.png" />
    `;
    document.title = 'Coop Capture';
    document.body.innerHTML = `
      <h1>Heading one</h1>
      <h2>Heading two</h2>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
    `;

    expect(extractPageSnapshot(document)).toEqual({
      title: 'Coop Capture',
      metaDescription: 'A local-first page',
      headings: ['Heading one', 'Heading two'],
      paragraphs: ['First paragraph.', 'Second paragraph.'],
      previewImageUrl: 'https://example.com/cover.png',
    });
  });

  it('accepts only http and https pages for capture', () => {
    expect(isSupportedUrl('https://coop.town')).toBe(true);
    expect(isSupportedUrl('http://coop.town')).toBe(true);
    expect(isSupportedUrl('chrome://extensions')).toBe(false);
    expect(isSupportedUrl(undefined)).toBe(false);
  });
});
