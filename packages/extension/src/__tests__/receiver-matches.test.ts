import { describe, expect, it } from 'vitest';
import {
  resolveReceiverBridgeMatches,
  validateStoreReceiverAppUrl,
} from '../build/receiver-matches';

describe('resolveReceiverBridgeMatches', () => {
  it('defaults to localhost bridge matches when no receiver app URL is configured', () => {
    expect(resolveReceiverBridgeMatches()).toEqual(['http://127.0.0.1/*', 'http://localhost/*']);
  });

  it('keeps production builds scoped to the exact receiver origin', () => {
    expect(resolveReceiverBridgeMatches('https://receiver.coop')).toEqual([
      'https://receiver.coop/*',
    ]);
  });

  it('keeps coop.town production builds scoped to the exact receiver origin', () => {
    expect(resolveReceiverBridgeMatches('https://coop.town')).toEqual(['https://coop.town/*']);
  });

  it('preserves localhost bridges when the configured receiver app is local', () => {
    expect(resolveReceiverBridgeMatches('http://localhost:3001')).toEqual([
      'http://127.0.0.1/*',
      'http://localhost/*',
      'http://localhost:3001/*',
    ]);
  });

  it('preserves localhost bridges when the configured receiver app uses IPv6 loopback', () => {
    expect(resolveReceiverBridgeMatches('https://[::1]:3001')).toEqual([
      'http://127.0.0.1/*',
      'http://localhost/*',
      'https://[::1]:3001/*',
    ]);
  });

  it('throws when the configured receiver app URL is malformed', () => {
    expect(() => resolveReceiverBridgeMatches('not-a-url')).toThrow(
      /VITE_COOP_RECEIVER_APP_URL must be a valid http\(s\) URL/u,
    );
  });
});

describe('validateStoreReceiverAppUrl', () => {
  it('rejects a missing receiver app URL for store validation', () => {
    expect(validateStoreReceiverAppUrl()).toEqual({
      ok: false,
      message:
        'VITE_COOP_RECEIVER_APP_URL must be set to the production HTTPS receiver origin before running store-readiness validation.',
    });
  });

  it('rejects malformed receiver app URLs for store validation', () => {
    expect(validateStoreReceiverAppUrl('not-a-url')).toEqual({
      ok: false,
      message: 'VITE_COOP_RECEIVER_APP_URL must be a valid http(s) URL. Received: not-a-url',
    });
  });

  it('rejects localhost receiver app URLs for store validation', () => {
    expect(validateStoreReceiverAppUrl('https://localhost:3001')).toEqual({
      ok: false,
      message:
        'VITE_COOP_RECEIVER_APP_URL must point at the production receiver origin, not localhost, for store-readiness validation.',
    });
  });

  it('rejects IPv6 loopback receiver app URLs for store validation', () => {
    expect(validateStoreReceiverAppUrl('https://[::1]:3001')).toEqual({
      ok: false,
      message:
        'VITE_COOP_RECEIVER_APP_URL must point at the production receiver origin, not localhost, for store-readiness validation.',
    });
  });

  it('rejects non-HTTPS receiver app URLs for store validation', () => {
    expect(validateStoreReceiverAppUrl('http://localhost:3001')).toEqual({
      ok: false,
      message: 'VITE_COOP_RECEIVER_APP_URL must use HTTPS for Chrome Web Store release validation.',
    });
  });

  it('accepts a production HTTPS receiver app URL for store validation', () => {
    const result = validateStoreReceiverAppUrl('https://receiver.coop');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.href).toBe('https://receiver.coop/');
    }
  });

  it('accepts https://coop.town as the production receiver origin', () => {
    const result = validateStoreReceiverAppUrl('https://coop.town');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.href).toBe('https://coop.town/');
    }
  });
});
