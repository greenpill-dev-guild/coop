import { describe, expect, it } from 'vitest';
import {
  isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls,
  resolveArchiveGatewayUrl,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveReceiverAppUrl,
} from '../config';

describe('runtime config helpers', () => {
  it('normalizes chain and mode defaults', () => {
    expect(resolveConfiguredChain('arbitrum')).toBe('arbitrum');
    expect(resolveConfiguredChain('sepolia')).toBe('sepolia');
    expect(resolveConfiguredChain('celo')).toBe('sepolia');
    expect(resolveConfiguredChain('anything-else')).toBe('sepolia');
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
    expect(resolveReceiverAppUrl(undefined)).toBe('http://127.0.0.1:3001');
    expect(resolveReceiverAppUrl('https://receiver.example')).toBe('https://receiver.example');
    expect(isLocalEnhancementEnabled(undefined)).toBe(true);
    expect(isLocalEnhancementEnabled('off')).toBe(false);
  });
});
