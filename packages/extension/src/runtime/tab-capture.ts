export interface CaptureSnapshot {
  title: string;
  metaDescription?: string;
  headings: string[];
  paragraphs: string[];
  previewImageUrl?: string;
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

  return {
    title: source.title,
    metaDescription:
      source.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined,
    headings,
    paragraphs,
    previewImageUrl:
      source.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? undefined,
  };
}

export function isSupportedUrl(url?: string): url is string {
  return Boolean(url?.startsWith('http://') || url?.startsWith('https://'));
}
