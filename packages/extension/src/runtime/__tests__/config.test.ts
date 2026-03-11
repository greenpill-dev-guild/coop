import { describe, expect, it } from 'vitest';
import {
  isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls,
  resolveArchiveGatewayUrl,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
} from '../config';

describe('runtime config helpers', () => {
  it('normalizes chain and mode defaults', () => {
    expect(resolveConfiguredChain('celo')).toBe('celo');
    expect(resolveConfiguredChain('anything-else')).toBe('celo-sepolia');
    expect(resolveConfiguredOnchainMode(undefined, 'pimlico-key')).toBe('live');
    expect(resolveConfiguredOnchainMode(undefined, undefined)).toBe('mock');
    expect(resolveConfiguredArchiveMode(undefined, 'https://issuer.example')).toBe('live');
    expect(resolveConfiguredArchiveMode('mock', 'https://issuer.example')).toBe('mock');
  });

  it('parses optional signaling and archive settings', () => {
    expect(parseConfiguredSignalingUrls(undefined)).toBeUndefined();
    expect(parseConfiguredSignalingUrls('  ws://one.example, ws://two.example  ')).toEqual([
      'ws://one.example',
      'ws://two.example',
    ]);
    expect(resolveArchiveGatewayUrl(undefined)).toBe('https://storacha.link');
    expect(resolveArchiveGatewayUrl('https://gateway.example')).toBe('https://gateway.example');
    expect(isLocalEnhancementEnabled(undefined)).toBe(true);
    expect(isLocalEnhancementEnabled('off')).toBe(false);
  });
});
