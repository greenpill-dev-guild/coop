import { describe, expect, it } from 'vitest';
import { assertHexString, createId, hashJson } from '../index';

describe('assertHexString', () => {
  it('returns the value when given a valid hex string', () => {
    expect(assertHexString('0xabcdef1234')).toBe('0xabcdef1234');
  });

  it('rejects an empty hex string (0x)', () => {
    expect(() => assertHexString('0x')).toThrow(/hex string/i);
  });

  it('accepts a full 40-char address', () => {
    const addr = '0x1111111111111111111111111111111111111111';
    expect(assertHexString(addr)).toBe(addr);
  });

  it('throws for a non-0x-prefixed string', () => {
    expect(() => assertHexString('abcdef')).toThrow(/hex string/i);
  });

  it('throws for a string containing non-hex characters', () => {
    expect(() => assertHexString('0xZZZZ')).toThrow(/hex string/i);
  });

  it('includes the fieldName in the error when provided', () => {
    expect(() => assertHexString('bad', 'publicKey')).toThrow(/publicKey/);
  });

  it('gives a generic error when no fieldName is provided', () => {
    expect(() => assertHexString('bad')).toThrow(/Expected a hex string/);
  });

  it('truncates long invalid values in the error message', () => {
    const longValue = 'this-is-a-very-long-invalid-value-that-should-be-truncated';
    expect(() => assertHexString(longValue)).toThrow(longValue.slice(0, 20));
  });
});

describe('createId', () => {
  it('generates a prefixed id', () => {
    const id = createId('test');
    expect(id).toMatch(/^test-/);
  });

  it('generates unique ids across calls', () => {
    const a = createId('coop');
    const b = createId('coop');
    expect(a).not.toBe(b);
  });

  it('uses the default prefix when none is given', () => {
    const id = createId();
    expect(id).toMatch(/^coop-/);
  });
});

describe('hashJson', () => {
  it('produces the same hash regardless of key insertion order', () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    expect(hashJson(a)).toBe(hashJson(b));
  });

  it('sorts keys recursively in nested objects', () => {
    const a = { outer: { z: 1, a: 2 }, foo: 'bar' };
    const b = { foo: 'bar', outer: { a: 2, z: 1 } };
    expect(hashJson(a)).toBe(hashJson(b));
  });

  it('preserves array order (arrays are not sorted)', () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    expect(hashJson(a)).not.toBe(hashJson(b));
  });

  it('handles null, undefined, strings, and numbers', () => {
    expect(hashJson(null)).toBe(hashJson(null));
    expect(hashJson('hello')).toBe(hashJson('hello'));
    expect(hashJson(42)).toBe(hashJson(42));
    expect(hashJson(null)).not.toBe(hashJson(undefined));
  });
});
