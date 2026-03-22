import { describe, expect, it } from 'vitest';
import {
  getAddressExplorerUrl,
  getAnchorExplorerUrl,
  getFilfoxDealUrl,
  getFilfoxProviderUrl,
  truncateAddress,
  truncateCid,
} from '../helpers';

describe('getAnchorExplorerUrl', () => {
  it('returns arbiscan.io URL for arbitrum chain', () => {
    const url = getAnchorExplorerUrl('0xabc123', 'arbitrum');
    expect(url).toBe('https://arbiscan.io/tx/0xabc123');
  });

  it('returns sepolia.etherscan.io URL for sepolia chain', () => {
    const url = getAnchorExplorerUrl('0xdef456', 'sepolia');
    expect(url).toBe('https://sepolia.etherscan.io/tx/0xdef456');
  });

  it('falls back to sepolia for unknown chain keys', () => {
    const url = getAnchorExplorerUrl('0x789', 'unknown');
    expect(url).toBe('https://sepolia.etherscan.io/tx/0x789');
  });
});

describe('getFilfoxProviderUrl', () => {
  it('returns filfox address URL for a provider ID', () => {
    const url = getFilfoxProviderUrl('f01234');
    expect(url).toBe('https://filfox.info/en/address/f01234');
  });
});

describe('getFilfoxDealUrl', () => {
  it('returns filfox deal URL for a deal ID', () => {
    const url = getFilfoxDealUrl('12345');
    expect(url).toBe('https://filfox.info/en/deal/12345');
  });
});

describe('truncateCid', () => {
  it('truncates a long CID with default prefix/suffix lengths', () => {
    const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    const result = truncateCid(cid);
    expect(result).toBe('bafybeig...5fbzdi');
    expect(result.length).toBeLessThan(cid.length);
  });

  it('returns the full CID if it is shorter than prefix + suffix + 3', () => {
    const shortCid = 'bafy1234567890abc';
    const result = truncateCid(shortCid);
    expect(result).toBe(shortCid);
  });

  it('uses custom prefix and suffix lengths', () => {
    const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    const result = truncateCid(cid, 4, 4);
    expect(result).toBe('bafy...bzdi');
  });

  it('returns the full CID when exactly at the threshold', () => {
    // prefix 8 + suffix 6 + 3 = 17; a 17-char string should not be truncated
    const cid = '12345678901234567';
    const result = truncateCid(cid);
    expect(result).toBe(cid);
  });
});

describe('getAddressExplorerUrl', () => {
  it('returns arbiscan.io address URL for arbitrum chain', () => {
    const url = getAddressExplorerUrl('0xabc123', 'arbitrum');
    expect(url).toBe('https://arbiscan.io/address/0xabc123');
  });

  it('returns sepolia.etherscan.io address URL for sepolia chain', () => {
    const url = getAddressExplorerUrl('0xdef456', 'sepolia');
    expect(url).toBe('https://sepolia.etherscan.io/address/0xdef456');
  });

  it('falls back to sepolia for unknown chain keys', () => {
    const url = getAddressExplorerUrl('0x789', 'unknown');
    expect(url).toBe('https://sepolia.etherscan.io/address/0x789');
  });
});

describe('truncateAddress', () => {
  it('truncates a standard 42-char address', () => {
    expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });

  it('returns short addresses as-is', () => {
    expect(truncateAddress('0x1234567890')).toBe('0x1234567890');
  });
});
