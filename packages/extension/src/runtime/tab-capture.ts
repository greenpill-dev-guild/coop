export interface CaptureSnapshot {
  title: string;
  metaDescription?: string;
  headings: string[];
  paragraphs: string[];
  socialPreviewImageUrl?: string;
  previewImageUrl?: string;
}

function getMetaContent(source: Document, selectors: string[]) {
  for (const selector of selectors) {
    const value = source.querySelector(selector)?.getAttribute('content')?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function extractPageSnapshot(source: Document = document): CaptureSnapshot {
  const headings = Array.from(source.querySelectorAll('h1, h2, h3'))
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 8);
  const paragraphs = Array.from(source.querySelectorAll('p'))
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 12);
  const socialPreviewImageUrl = getMetaContent(source, [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image:src"]',
    'meta[name="twitter:image"]',
  ]);

  return {
    title: source.title,
    metaDescription:
      source.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined,
    headings,
    paragraphs,
    socialPreviewImageUrl,
    previewImageUrl: socialPreviewImageUrl,
  };
}

export function isSupportedUrl(url?: string): url is string {
  return Boolean(url?.startsWith('http://') || url?.startsWith('https://'));
}
