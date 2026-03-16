import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl } from '../url-safety';

describe('isSafeExternalUrl', () => {
  it('accepts https URLs', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('https://coop.town/path?q=1')).toBe(true);
  });

  it('accepts http URLs', () => {
    expect(isSafeExternalUrl('http://localhost:3000')).toBe(true);
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(isSafeExternalUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects blob: protocol', () => {
    expect(isSafeExternalUrl('blob:http://example.com/uuid')).toBe(false);
  });

  it('rejects file: protocol', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects ftp: protocol', () => {
    expect(isSafeExternalUrl('ftp://files.example.com')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSafeExternalUrl(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSafeExternalUrl('')).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    expect(isSafeExternalUrl('not-a-url')).toBe(false);
    expect(isSafeExternalUrl('://missing-scheme')).toBe(false);
  });
});
