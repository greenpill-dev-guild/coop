import { describe, expect, it } from 'vitest';

import {
  buildIceServers,
  defaultIceServers,
  defaultSignalingUrls,
  filterUsableSignalingUrls,
  parseSignalingUrls,
} from '../config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('defaultSignalingUrls', () => {
  it('is a non-empty array of wss:// URLs', () => {
    expect(defaultSignalingUrls).toBeInstanceOf(Array);
    expect(defaultSignalingUrls.length).toBeGreaterThan(0);
    for (const url of defaultSignalingUrls) {
      expect(url).toMatch(/^wss:\/\//);
    }
  });
});

describe('defaultIceServers', () => {
  it('is a non-empty array of STUN servers', () => {
    expect(defaultIceServers).toBeInstanceOf(Array);
    expect(defaultIceServers.length).toBeGreaterThan(0);
    for (const server of defaultIceServers) {
      expect(server).toHaveProperty('urls');
      expect(server.urls).toMatch(/^stun:/);
    }
  });
});

// ---------------------------------------------------------------------------
// parseSignalingUrls
// ---------------------------------------------------------------------------

describe('parseSignalingUrls', () => {
  it('returns undefined when called with no argument', () => {
    expect(parseSignalingUrls()).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(parseSignalingUrls(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(parseSignalingUrls('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only input', () => {
    expect(parseSignalingUrls('   ')).toBeUndefined();
  });

  it('returns undefined for a string of only commas', () => {
    expect(parseSignalingUrls(',,,')).toBeUndefined();
  });

  it('parses a single URL', () => {
    expect(parseSignalingUrls('wss://example.com')).toEqual(['wss://example.com']);
  });

  it('parses multiple comma-separated URLs', () => {
    const result = parseSignalingUrls(
      'wss://a.example.com,wss://b.example.com,wss://c.example.com',
    );
    expect(result).toEqual(['wss://a.example.com', 'wss://b.example.com', 'wss://c.example.com']);
  });

  it('trims whitespace around URLs', () => {
    const result = parseSignalingUrls('  wss://a.com , wss://b.com  ');
    expect(result).toEqual(['wss://a.com', 'wss://b.com']);
  });

  it('filters out empty segments from trailing commas', () => {
    const result = parseSignalingUrls('wss://a.com,,wss://b.com,');
    expect(result).toEqual(['wss://a.com', 'wss://b.com']);
  });
});

// ---------------------------------------------------------------------------
// filterUsableSignalingUrls
// ---------------------------------------------------------------------------

describe('filterUsableSignalingUrls', () => {
  it('returns an empty array when called with no argument', () => {
    expect(filterUsableSignalingUrls()).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    expect(filterUsableSignalingUrls([])).toEqual([]);
  });

  it('keeps ws:// URLs', () => {
    expect(filterUsableSignalingUrls(['ws://localhost:4444'])).toEqual(['ws://localhost:4444']);
  });

  it('keeps wss:// URLs', () => {
    expect(filterUsableSignalingUrls(['wss://signal.example.com'])).toEqual([
      'wss://signal.example.com',
    ]);
  });

  it('keeps http:// URLs', () => {
    expect(filterUsableSignalingUrls(['http://localhost:3000'])).toEqual(['http://localhost:3000']);
  });

  it('keeps https:// URLs', () => {
    expect(filterUsableSignalingUrls(['https://signal.example.com'])).toEqual([
      'https://signal.example.com',
    ]);
  });

  it('rejects ftp:// URLs', () => {
    expect(filterUsableSignalingUrls(['ftp://files.example.com'])).toEqual([]);
  });

  it('rejects custom protocol URLs', () => {
    expect(filterUsableSignalingUrls(['custom://something'])).toEqual([]);
  });

  it('rejects malformed URLs', () => {
    expect(filterUsableSignalingUrls(['not-a-url'])).toEqual([]);
  });

  it('filters a mixed list keeping only valid protocols', () => {
    const input = [
      'wss://good.com',
      'ftp://bad.com',
      'http://also-good.com',
      'not-a-url',
      'https://secure.com',
      'ws://local:1234',
    ];
    expect(filterUsableSignalingUrls(input)).toEqual([
      'wss://good.com',
      'http://also-good.com',
      'https://secure.com',
      'ws://local:1234',
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildIceServers
// ---------------------------------------------------------------------------

describe('buildIceServers', () => {
  it('returns defaults when called with no argument', () => {
    expect(buildIceServers()).toEqual(defaultIceServers);
  });

  it('returns defaults when called with undefined', () => {
    expect(buildIceServers(undefined)).toEqual(defaultIceServers);
  });

  it('returns defaults when turn.urls is undefined', () => {
    expect(buildIceServers({ username: 'user', credential: 'pass' })).toEqual(defaultIceServers);
  });

  it('returns defaults when turn.urls is an empty string', () => {
    expect(buildIceServers({ urls: '', username: 'user', credential: 'pass' })).toEqual(
      defaultIceServers,
    );
  });

  it('returns defaults when turn.urls contains only whitespace and commas', () => {
    expect(buildIceServers({ urls: ' , , ', username: 'user', credential: 'pass' })).toEqual(
      defaultIceServers,
    );
  });

  it('appends a single TURN server to defaults', () => {
    const result = buildIceServers({
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass',
    });

    expect(result).toEqual([
      ...defaultIceServers,
      {
        urls: ['turn:turn.example.com:3478'],
        username: 'user',
        credential: 'pass',
      },
    ]);
  });

  it('appends multiple TURN servers from comma-separated URLs', () => {
    const result = buildIceServers({
      urls: 'turn:a.example.com:3478,turn:b.example.com:3478',
      username: 'user',
      credential: 'pass',
    });

    expect(result).toEqual([
      ...defaultIceServers,
      {
        urls: ['turn:a.example.com:3478', 'turn:b.example.com:3478'],
        username: 'user',
        credential: 'pass',
      },
    ]);
  });

  it('trims whitespace in TURN URLs', () => {
    const result = buildIceServers({
      urls: '  turn:a.com:3478 , turn:b.com:3478  ',
      username: 'u',
      credential: 'c',
    });

    expect(result[result.length - 1].urls).toEqual(['turn:a.com:3478', 'turn:b.com:3478']);
  });

  it('defaults username and credential to empty strings when omitted', () => {
    const result = buildIceServers({
      urls: 'turn:turn.example.com:3478',
    });

    const turnEntry = result[result.length - 1];
    expect(turnEntry.username).toBe('');
    expect(turnEntry.credential).toBe('');
  });

  it('preserves all default STUN servers in the result', () => {
    const result = buildIceServers({
      urls: 'turn:turn.example.com:3478',
      username: 'u',
      credential: 'c',
    });

    for (const server of defaultIceServers) {
      expect(result).toContainEqual(server);
    }
  });
});
