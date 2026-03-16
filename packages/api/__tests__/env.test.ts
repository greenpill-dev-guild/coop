// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/lib/env';

describe('loadEnv', () => {
  beforeEach(() => {
    vi.stubEnv('PORT', '');
    vi.stubEnv('HOST', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns defaults when no env vars are set', () => {
    const env = loadEnv();
    expect(env.port).toBe(4444);
    expect(env.host).toBe('127.0.0.1');
  });

  it('reads PORT from process.env', () => {
    process.env.PORT = '8080';
    const env = loadEnv();
    expect(env.port).toBe(8080);
  });

  it('reads HOST from process.env', () => {
    process.env.HOST = '0.0.0.0';
    const env = loadEnv();
    expect(env.host).toBe('0.0.0.0');
  });

  it('throws on non-numeric PORT', () => {
    process.env.PORT = 'not-a-number';
    expect(() => loadEnv()).toThrow('Invalid PORT');
  });

  it('throws on negative PORT', () => {
    process.env.PORT = '-1';
    expect(() => loadEnv()).toThrow('Invalid PORT');
  });

  it('throws on PORT > 65535', () => {
    process.env.PORT = '70000';
    expect(() => loadEnv()).toThrow('Invalid PORT');
  });

  it('accepts PORT 0', () => {
    process.env.PORT = '0';
    const env = loadEnv();
    expect(env.port).toBe(0);
  });

  it('accepts PORT 65535', () => {
    process.env.PORT = '65535';
    const env = loadEnv();
    expect(env.port).toBe(65535);
  });
});
