import { describe, expect, it } from 'vitest';
import { decodeArchiveAnchorCalldata, encodeArchiveAnchorCalldata } from '../onchain';

describe('archive anchor calldata encoding', () => {
  const baseInput = {
    rootCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3okuez1',
    pieceCid: 'baga6ea4seaqao7s73y24kcutaosvacpdjgfe5pw76ooefnyqw4yyja',
    scope: 'artifact' as const,
    coopId: 'coop-abc-123',
    timestamp: '2026-03-14T12:00:00.000Z',
  };

  it('encodes to a valid hex string starting with 0x', () => {
    const result = encodeArchiveAnchorCalldata(baseInput);
    expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it('starts with a 4-byte function selector prefix', () => {
    const result = encodeArchiveAnchorCalldata(baseInput);
    // First 4 bytes (8 hex chars) after 0x should be the selector
    expect(result.length).toBeGreaterThan(10);
    const selector = result.slice(0, 10); // 0x + 8 hex chars
    expect(selector).toMatch(/^0x[0-9a-fA-F]{8}$/);
  });

  it('produces consistent output for the same input', () => {
    const a = encodeArchiveAnchorCalldata(baseInput);
    const b = encodeArchiveAnchorCalldata(baseInput);
    expect(a).toBe(b);
  });

  it('round-trips through encode and decode', () => {
    const encoded = encodeArchiveAnchorCalldata(baseInput);
    const decoded = decodeArchiveAnchorCalldata(encoded);

    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.rootCid).toBe(baseInput.rootCid);
    expect(decoded.pieceCid).toBe(baseInput.pieceCid);
    expect(decoded.scope).toBe(baseInput.scope);
    expect(decoded.coopId).toBe(baseInput.coopId);
    expect(decoded.timestamp).toBe(baseInput.timestamp);
  });

  it('round-trips when pieceCid is omitted (empty string)', () => {
    const input = { ...baseInput, pieceCid: undefined };
    const encoded = encodeArchiveAnchorCalldata(input);
    const decoded = decodeArchiveAnchorCalldata(encoded);

    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.rootCid).toBe(baseInput.rootCid);
    expect(decoded.pieceCid).toBeUndefined();
    expect(decoded.scope).toBe('artifact');
  });

  it('handles snapshot scope', () => {
    const input = { ...baseInput, scope: 'snapshot' as const };
    const encoded = encodeArchiveAnchorCalldata(input);
    const decoded = decodeArchiveAnchorCalldata(encoded);

    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.scope).toBe('snapshot');
  });

  it('decode returns null for data shorter than 4-byte selector', () => {
    expect(decodeArchiveAnchorCalldata('0x')).toBeNull();
    expect(decodeArchiveAnchorCalldata('0x1234')).toBeNull();
    expect(decodeArchiveAnchorCalldata('0x12345678')).toBeNull();
  });

  it('decode returns null for data with wrong selector', () => {
    const encoded = encodeArchiveAnchorCalldata(baseInput);
    // Replace the selector with a different one
    const corrupted = `0xdeadbeef${encoded.slice(10)}` as `0x${string}`;
    expect(decodeArchiveAnchorCalldata(corrupted)).toBeNull();
  });

  it('decode returns null for malformed hex', () => {
    expect(decodeArchiveAnchorCalldata('0xnothex' as `0x${string}`)).toBeNull();
  });
});
