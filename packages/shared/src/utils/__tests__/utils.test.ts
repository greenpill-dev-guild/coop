import { describe, expect, it } from 'vitest';
import { assertHexString, createId } from '../index';

describe('assertHexString', () => {
  it('returns the value when given a valid hex string', () => {
    expect(assertHexString('0xabcdef1234')).toBe('0xabcdef1234');
  });

  it('accepts an empty hex string (0x)', () => {
    expect(assertHexString('0x')).toBe('0x');
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
