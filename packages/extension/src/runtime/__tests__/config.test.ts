import { describe, expect, it } from 'vitest';
import {
  isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls,
  resolveArchiveGatewayUrl,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveConfiguredSessionMode,
  resolveReceiverAppUrl,
  resolveTrustedNodeArchiveBootstrapConfig,
} from '../config';

describe('runtime config helpers', () => {
  it('normalizes chain and mode defaults', () => {
    expect(resolveConfiguredChain('arbitrum')).toBe('arbitrum');
    expect(resolveConfiguredChain('sepolia')).toBe('sepolia');
    expect(resolveConfiguredChain('celo')).toBe('sepolia');
    expect(resolveConfiguredChain('anything-else')).toBe('sepolia');
    expect(resolveConfiguredOnchainMode(undefined, 'pimlico-key')).toBe('mock');
    expect(resolveConfiguredOnchainMode(undefined, undefined)).toBe('mock');
    expect(resolveConfiguredOnchainMode('live', 'pimlico-key')).toBe('live');
    expect(resolveConfiguredArchiveMode(undefined)).toBe('mock');
    expect(resolveConfiguredArchiveMode('mock')).toBe('mock');
    expect(resolveConfiguredArchiveMode('live')).toBe('live');
    expect(resolveConfiguredSessionMode(undefined)).toBe('off');
    expect(resolveConfiguredSessionMode('mock')).toBe('mock');
    expect(resolveConfiguredSessionMode('live')).toBe('live');
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

  it('parses trusted-node archive bootstrap env into local config', () => {
    expect(
      resolveTrustedNodeArchiveBootstrapConfig({
        VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID: 'did:key:space',
        VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER: 'did:key:issuer',
        VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION: 'space-proof',
        VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS: JSON.stringify(['proof-a', 'proof-b']),
        VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO: 'true',
        VITE_COOP_TRUSTED_NODE_ARCHIVE_EXPIRATION_SECONDS: '900',
      }),
    ).toEqual({
      spaceDid: 'did:key:space',
      delegationIssuer: 'did:key:issuer',
      gatewayBaseUrl: 'https://storacha.link',
      spaceDelegation: 'space-proof',
      proofs: ['proof-a', 'proof-b'],
      allowsFilecoinInfo: true,
      expirationSeconds: 900,
    });
    expect(resolveTrustedNodeArchiveBootstrapConfig({})).toBeNull();
  });
});
