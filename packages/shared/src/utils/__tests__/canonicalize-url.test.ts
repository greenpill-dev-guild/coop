import { describe, expect, it } from 'vitest';
import { canonicalizeUrl } from '../index';

describe('canonicalizeUrl', () => {
  it('strips fragment identifiers', () => {
    expect(canonicalizeUrl('https://example.com/page#section-2')).toBe('https://example.com/page');
  });

  it('strips empty fragment identifiers', () => {
    expect(canonicalizeUrl('https://example.com/page#')).toBe('https://example.com/page');
  });

  it('strips utm_source', () => {
    expect(canonicalizeUrl('https://example.com/?utm_source=twitter')).toBe('https://example.com/');
  });

  it('strips utm_medium', () => {
    expect(canonicalizeUrl('https://example.com/?utm_medium=social')).toBe('https://example.com/');
  });

  it('strips utm_campaign', () => {
    expect(canonicalizeUrl('https://example.com/?utm_campaign=launch')).toBe(
      'https://example.com/',
    );
  });

  it('strips utm_term', () => {
    expect(canonicalizeUrl('https://example.com/?utm_term=keyword')).toBe('https://example.com/');
  });

  it('strips utm_content', () => {
    expect(canonicalizeUrl('https://example.com/?utm_content=banner')).toBe('https://example.com/');
  });

  it('strips gclid (Google click ID)', () => {
    expect(canonicalizeUrl('https://example.com/?gclid=abc123')).toBe('https://example.com/');
  });

  it('strips fbclid (Facebook click ID)', () => {
    expect(canonicalizeUrl('https://example.com/?fbclid=abc123')).toBe('https://example.com/');
  });

  it('strips multiple tracking params at once', () => {
    const url =
      'https://example.com/page?utm_source=twitter&utm_medium=social&gclid=abc&fbclid=xyz';
    expect(canonicalizeUrl(url)).toBe('https://example.com/page');
  });

  it('preserves path and non-tracking query params', () => {
    expect(canonicalizeUrl('https://example.com/search?q=test&page=2')).toBe(
      'https://example.com/search?q=test&page=2',
    );
  });

  it('preserves non-tracking params while stripping tracking params', () => {
    const url = 'https://example.com/article?id=42&utm_source=newsletter&ref=homepage';
    expect(canonicalizeUrl(url)).toBe('https://example.com/article?id=42&ref=homepage');
  });

  it('handles URLs with no query string', () => {
    expect(canonicalizeUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  it('handles URLs with empty query string', () => {
    expect(canonicalizeUrl('https://example.com/page?')).toBe('https://example.com/page');
  });

  it('handles URLs with both tracking params and fragment', () => {
    const url = 'https://example.com/page?utm_source=twitter&q=hello#top';
    expect(canonicalizeUrl(url)).toBe('https://example.com/page?q=hello');
  });

  it('returns the raw string for invalid URLs', () => {
    expect(canonicalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('preserves port numbers', () => {
    expect(canonicalizeUrl('https://example.com:8080/page?utm_source=x')).toBe(
      'https://example.com:8080/page',
    );
  });

  it('preserves authentication info in URL', () => {
    expect(canonicalizeUrl('https://user:pass@example.com/page')).toBe(
      'https://user:pass@example.com/page',
    );
  });
});
