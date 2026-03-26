import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  preflightActiveTabCapture,
  preflightManualCapture,
  toOriginPattern,
} from '../capture-preflight';

describe('capture preflight', () => {
  const contains = vi.fn();
  const request = vi.fn();
  const query = vi.fn();

  beforeEach(() => {
    contains.mockReset();
    request.mockReset();
    query.mockReset();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        tabs: {
          query,
        },
        permissions: {
          contains,
          request,
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('skips permission prompts when the standard tab origins are already granted', async () => {
    query.mockResolvedValue([
      { url: 'http://127.0.0.1:3001/manual-roundup-fixture.html' },
      { url: 'chrome-extension://abc123/popup.html' },
    ]);
    contains.mockResolvedValue(true);

    const result = await preflightManualCapture();

    expect(result).toEqual({ ok: true });
    expect(contains).toHaveBeenCalledWith({
      origins: ['http://127.0.0.1/*'],
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('requests only the active tab origin when access is missing', async () => {
    query.mockResolvedValue([{ url: 'https://example.com/path?q=1' }]);
    contains.mockResolvedValue(false);
    request.mockResolvedValue(true);

    const result = await preflightActiveTabCapture();

    expect(result).toMatchObject({ ok: true });
    expect(contains).toHaveBeenCalledWith({
      origins: ['https://example.com/*'],
    });
    expect(request).toHaveBeenCalledWith({
      origins: ['https://example.com/*'],
    });
  });

  it('builds stable origin patterns for standard web urls', () => {
    expect(toOriginPattern('http://127.0.0.1:3001/fixture')).toBe('http://127.0.0.1/*');
    expect(toOriginPattern('https://example.com/foo?bar=1')).toBe('https://example.com/*');
    expect(toOriginPattern('chrome-extension://coop/popup.html')).toBe('chrome-extension://coop/*');
  });
});
