import { describe, expect, it } from 'vitest';
import {
  DEV_ACCESS_TOKEN_PARAM,
  type DevEnvironmentState,
  hasValidDevAccess,
  isDevAccessRequired,
  isLocalHostname,
  stripDevAccessToken,
} from '../dev-environment';

const baseState: DevEnvironmentState = {
  version: 1,
  updatedAt: '2026-03-20T12:00:00.000Z',
  accessToken: 'COOP1234',
  app: {
    localUrl: 'http://127.0.0.1:3001',
    publicUrl: 'https://coop-dev.trycloudflare.com',
    qrUrl: 'https://coop-dev.trycloudflare.com/?coop-dev-token=COOP1234',
    status: 'ready',
  },
  api: {
    localUrl: 'http://127.0.0.1:4444',
    websocketUrl: 'wss://signal-dev.trycloudflare.com',
    publicUrl: 'https://signal-dev.trycloudflare.com',
    status: 'ready',
  },
  docs: {
    localUrl: 'http://127.0.0.1:3003',
    status: 'ready',
  },
  extension: {
    distPath: '/tmp/extension',
    mode: 'watch',
    receiverAppUrl: 'https://coop-dev.trycloudflare.com',
    signalingUrls: ['wss://signal-dev.trycloudflare.com'],
    status: 'ready',
  },
  tunnel: {
    enabled: true,
    provider: 'cloudflare',
    status: 'ready',
  },
};

describe('dev environment helpers', () => {
  it('recognizes localhost variants', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('127.0.0.1')).toBe(true);
    expect(isLocalHostname('app.localhost')).toBe(true);
    expect(isLocalHostname('coop-dev.trycloudflare.com')).toBe(false);
  });

  it('requires a dev access token only on the public tunnel origin', () => {
    expect(
      isDevAccessRequired(baseState, new URL('https://coop-dev.trycloudflare.com/landing')),
    ).toBe(true);
    expect(isDevAccessRequired(baseState, new URL('http://127.0.0.1:3001/landing'))).toBe(false);
    expect(
      isDevAccessRequired(baseState, new URL('https://somewhere-else.trycloudflare.com/landing')),
    ).toBe(false);
  });

  it('accepts either the URL token or the stored token', () => {
    const withQuery = new URL('https://coop-dev.trycloudflare.com/pair');
    withQuery.searchParams.set(DEV_ACCESS_TOKEN_PARAM, 'COOP1234');

    expect(hasValidDevAccess(baseState, withQuery, null)).toBe(true);
    expect(
      hasValidDevAccess(baseState, new URL('https://coop-dev.trycloudflare.com/pair'), 'COOP1234'),
    ).toBe(true);
    expect(
      hasValidDevAccess(baseState, new URL('https://coop-dev.trycloudflare.com/pair'), 'WRONG'),
    ).toBe(false);
  });

  it('strips only the dev token from the URL', () => {
    const url = new URL('https://coop-dev.trycloudflare.com/pair?payload=abc');
    url.searchParams.set(DEV_ACCESS_TOKEN_PARAM, 'COOP1234');

    expect(stripDevAccessToken(url)).toBe('/pair?payload=abc');
  });
});
